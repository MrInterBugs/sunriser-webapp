<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,source} from './i18n';
 import ConfigurationNotice from './ui/ConfigurationNotice.svelte';
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
 const configurationReconciled=$derived(!$configurationState.recovery&&snapshotRevision===$configurationState.revision);
  import DayCycle from "./ui/DayCycle.svelte";
  import ChannelIdentity from './ui/ChannelIdentity.svelte';
  import {savedChannels,channelDisplay} from './channels';
  import { onMount, tick, untrack } from "svelte";
  import ActionButton from "./ui/ActionButton.svelte";
  import StateBadge from "./ui/StateBadge.svelte";
  import ScheduleTools from "./ScheduleTools.svelte";
  import SchedulePreview from "./ui/SchedulePreview.svelte";
  import type { Firmware } from "./api";
  import { inRange } from "./api";
  import {
    parseTime,
    getSchedules,
    saveSchedules,
    validateBook,
    validateCurve,
    schedulePatch,
    clone,
    flatten,
    shiftTime,
    shiftLevel,
    type ScheduleBook,
    type Point,
  } from "./schedules";
  let {
    active,
    busy,
    firmware,
    perform,
    onedit,ondraftview,
  }: {
    ondraftview?:(dirty:boolean)=>void;
    active: boolean;
    busy: boolean;
    firmware: Firmware;
    perform: (
      task: () => Promise<void>,
      success: string,
      failure: string,
      pending: string,
    ) => Promise<boolean>;
    onedit: () => void;
  } = $props();
  let book = $state<ScheduleBook>(),
    baseline = $state<ScheduleBook>();
  let attempted = $state(false),
    view = $state("day"),
    channel = $state(1),
    program = $state(0);
  let minutes = $state<number | undefined>(15),
    percent = $state<number | undefined>(5),
    targets = $state<boolean[]>([]);
  let focusedPoint = $state(-1);
  let rawPending=$state(false), toolsReset=$state(0);
  let pointsElement = $state<HTMLDivElement>();
  let chartElement = $state<HTMLDivElement>();
  let shortViewport = $state(false);
  let revealFrame = 0;
  // Reveal the focused control inside both the point list and the visible page.
  // Native focus scrolling alone cannot account for the sticky chart/dock.
  function queuePointReveal(target: EventTarget | null = document.activeElement) {
    if (!(target instanceof HTMLElement) || !pointsElement?.contains(target)) return;
    cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      if (!active || document.activeElement !== target || !pointsElement) return;
      let rect = target.getBoundingClientRect();
      const list = pointsElement.getBoundingClientRect();
      const row = target.closest<HTMLElement>('.point');
      const rowRect = row?.getBoundingClientRect();
      const region = rowRect && rowRect.height <= list.height - 8 ? rowRect : rect;
      if (region.top < list.top + 4) pointsElement.scrollTop += region.top - list.top - 4;
      else if (region.bottom > list.bottom - 4) pointsElement.scrollTop += region.bottom - list.bottom + 4;
      rect = target.getBoundingClientRect();
      const viewport = window.visualViewport;
      let top = (viewport?.offsetTop ?? 0) + 12;
      let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - 12;
      const dock = document.querySelector<HTMLElement>('.mobile-dock');
      if (dock?.getClientRects().length) bottom = Math.min(bottom, dock.getBoundingClientRect().top - 8);
      const bar = pointsElement.closest('form')?.querySelector<HTMLElement>('.save-bar');
      if (bar && getComputedStyle(bar).position === 'sticky' && bar.getBoundingClientRect().top <= top)
        top = Math.max(top, bar.getBoundingClientRect().bottom + 8);
      if (chartElement && getComputedStyle(chartElement).position === 'sticky') {
        const chart = chartElement.getBoundingClientRect();
        if (chart.left < rect.right && chart.right > rect.left) top = Math.max(top, chart.bottom + 8);
      }
      const visibleRow = row?.getBoundingClientRect();
      if (visibleRow && visibleRow.height <= bottom - top) rect = visibleRow;
      if (rect.top < top) window.scrollBy(0, rect.top - top);
      else if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
    });
  }
  onMount(() => {
    const resize = () => { shortViewport = (window.visualViewport?.height ?? innerHeight) <= 600; queuePointReveal(); };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); cancelAnimationFrame(revealFrame); };
  });
  const days = [
    source("schedules.sunday_bc5dd"),
    source("schedules.monday_932ee"),
    source("schedules.tuesday_42e43"),
    source("schedules.wednesday_5656b"),
    source("schedules.thursday_76031"),
    source("schedules.friday_d166e"),
    source("schedules.saturday_17063"),
    source("schedules.defaultProgram_afb84"),
  ];
  const modeNames = [source("schedules.noSchedule_15d88"), source("schedules.daily_72829"), source("schedules.weekly_158f3"), source("schedules.fixed_ab98f"), source("schedules.otherModePreserved_71c40")];
  const savedCurve = $derived(view === "program" ? baseline?.programs.find(p => p.id === program)?.points : baseline?.channels[channel - 1].points);
  const selected = $derived(book?.programs.find((p) => p.id === program));
  const curve = $derived(
    view === "program" ? selected?.points : book?.channels[channel - 1].points,
  );
  const curveEdited = $derived(JSON.stringify(curve) !== JSON.stringify(savedCurve));
  const pointFeedback = $derived((curve ?? []).map((point, i, points) => {
    const messages: string[] = [], time = parseTime(point.time);
    if (time === undefined) messages.push(source("schedules.useHHMMFrom0000To2359_e75fe"));
    else {
      const duplicates = points.flatMap((p, n) => n !== i && parseTime(p.time) === time ? [n + 1] : []);
      if (duplicates.length) messages.push(source("schedules.timeV0DuplicatesPointV1_59db7",{v0:point.time,v1:duplicates.join(', ')}));
    }
    if (!inRange(point.percent, 100)) messages.push(source("schedules.levelMustBeAWholeNumberFrom0To_4122f"));
    return messages.length ? $t("schedules.pointV0V1_afc85",{v0:i + 1,v1:messages.map(message=>$renderText(message)).join(' ')}) : '';
  }));
  const errors = $derived(book ? validateBook(book) : []);
  const edited = $derived(
    rawPending || (book && baseline ? JSON.stringify(book) !== JSON.stringify(baseline) : false),
  );
  const changes = $derived(
    book && baseline && !errors.length ? schedulePatch(baseline, book) : {},
  );
  const dirty = $derived(Object.keys(changes).length > 0);
  const referenced = $derived(
    !!book && book.channels.some((ch) => ch.week.includes(program)),
  );
  const canShift = $derived(!!curve && !validateCurve(curve).length);
  const preview = $derived.by(() => {
    if (!curve || !canShift) return "";
    const values = flatten(curve);
    if (!values.length) return "";
    const pairs = [];
    for (let i = 0; i < values.length; i += 2)
      pairs.push([values[i], values[i + 1]]);
    const first = pairs[0],
      last = pairs.at(-1)!;
    const midnight =
      pairs.length === 1
        ? first[1]
        : last[1] +
          ((first[1] - last[1]) * (1440 - last[0])) / (1440 - last[0] + first[0]);
    return [[0, midnight], ...pairs, [1440, midnight]]
      .map(([t, p]) => `${t},${100 - p}`)
      .join(" ");
  });
  $effect(() => {
    if (active && !attempted && !busy && !$configurationState.recovery) void load();
  });
  $effect(()=>{const value=!!edited;untrack(()=>ondraftview?.(value));});
  async function load(refresh=false) {
    attempted = true;
    await perform(
      async () => {
        const next = await getSchedules(firmware.pwm_count,refresh);
        book = next;
        toolsReset++;
        baseline = clone(next);
        snapshotRevision=configurationRevision();
        targets = Array(firmware.pwm_count).fill(false);
        if (!next.programs.some((p) => p.id === program))
          program = next.programs[0]?.id ?? 0;
      },
      source("schedules.schedulesLoaded_bb031"),
      source("schedules.couldNotLoadSchedulesCheckTheConnectionAndStored_30921"),
      source("schedules.loadingSchedules_8ef1a"),
    );
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!book || !baseline || !dirty || errors.length || rawPending || busy || !configurationCurrent(snapshotRevision)) return;
    const draft = clone(book);
    await perform(
      async () => {
        await saveSchedules(baseline!, draft, firmware);
        baseline = clone(draft);
      },
      source("app.saved_c0ae8"),
      source("schedules.couldNotConfirmScheduleSaveDraftsKeptReloadSchedules_03ea4"),
      source("schedules.savingSchedules_259d3"),
    );
  }
  function setCurve(points: Point[]) {
    if (!book) return;
    if (view === "program" && selected) selected.points = points;
    else book.channels[channel - 1].points = points;
    onedit();
  }
  async function addPoint() {
    if (!curve) return;
    const index = curve.length;
    setCurve([...curve, { time: '00:00', percent: 0 }]);
    await tick();
    const input = pointsElement?.querySelectorAll<HTMLInputElement>('input[type="text"]').item(index);
    input?.focus({ preventScroll: true });
    if (input) queuePointReveal(input);
  }
  function shift(direction: number, level = false) {
    if (!curve || !canShift) return;
    const step = level ? percent : minutes;
    if (!inRange(step, level ? 100 : 720) || step === 0) return;
    setCurve(
      level
        ? shiftLevel(curve, step * direction)
        : shiftTime(curve, step * direction),
    );
  }
  function addProgram(duplicate = false) {
    if (!book || book.lastId >= 65535) return;
    const originalProgram = baseline?.programs.find((p) => p.id === program);
    if (duplicate && (!originalProgram || edited)) return;
    const id = ++book.lastId,
      name = duplicate ? $t("schedules.copyOfV0_f49ba",{v0:originalProgram!.name}) : $t("schedules.newProgramV0_3a8b4",{v0:id});
    book.programs.push({
      id,
      name,
      points: duplicate ? clone(originalProgram!.points) : [],
      entry: { id, name },
    });
    program = id;
    view = "program";
    onedit();
  }
  function removeProgram() {
    if (!book || referenced || rawPending) return;
    book.programs = book.programs.filter((p) => p.id !== program);
    program = book.programs[0]?.id ?? 0;
    onedit();
  }
  function copyPlan() {
    if (!book || !baseline || edited || errors.length) return;
    const source = baseline.channels[channel - 1];
    if (source.manager > 3) return;
    book.channels.forEach((_, i) => {
      if (targets[i] && i !== channel - 1) book!.channels[i] = clone(source);
    });
    onedit();
  }
</script>

<div class="schedules" class:short-viewport={shortViewport} hidden={!active}>
  <div class="page-heading">
    <div><h1>{$t("schedules.schedules_26d9d")}</h1><p>{$t("schedules.shapeTheDayInDeviceLocalTime_bd020")} <a href="#lighting-tools">{$t("schedules.timeLapseAndDimming_9e98f")}</a></p></div>
    <div class="reload"><ActionButton secondary onclick={()=>load(true)} disabled={busy}>{$t("schedules.reloadSchedules_7b37d")}</ActionButton><small>{$t("schedules.reloadReplacesUnsavedEdits_83489")}</small></div>
  </div>
  {#if book}
    <div class="schedule-workspace"><aside class="channel-roster" aria-label={$t("schedules.scheduleChannels_593d6")}><h2>{$t("lightingdashboard.channels_18e03")}</h2>{#each book.channels as ch,i}<button type="button" aria-label={$t("schedules.selectChannelV0_634d4",{v0: i+1})} aria-pressed={channel===i+1 && view!=='program'} disabled={busy} onclick={()=>{channel=i+1;if(view==='program')view='day';}}><strong><ChannelIdentity number={i+1}/></strong><span>{$renderText(modeNames[ch.manager])}{JSON.stringify(ch)!==JSON.stringify(baseline!.channels[i])?$t('common.draftSuffix'):''}</span></button>{/each}</aside><form novalidate onsubmit={save} oninput={onedit} onchange={onedit}>
      <fieldset class="editor" disabled={busy}>
        <legend class="visually-hidden">{$t("schedules.scheduleEditor_0b45b")}</legend>
        <div class="save-bar">
          <div><ConfigurationNotice revision={snapshotRevision}/><StateBadge tone={edited ? 'draft' : 'neutral'}>{edited ? $t("schedules.unsavedScheduleChanges_a44b4") : $t("schedules.noUnsavedScheduleChanges_725e0")}</StateBadge><p>{$t("schedules.saveAppliesAllEditedChannelsAndPrograms_04a0c")}</p></div>
          <ActionButton type="submit" disabled={!dirty || !!errors.length || rawPending || !configurationReconciled}>{$t("schedules.saveSchedules_cb3a4")}</ActionButton>
        </div>
        <div class="schedule-identity">
        <div class="selection-context">
          {#if view !== 'program'}
            <span class="channel-number" aria-hidden="true">{String(channel).padStart(2,'0')}</span>
            <div><h2><ChannelIdentity number={channel}/></h2><p>{$t("schedules.savedMode_3ca9d")} <strong>{$renderText(modeNames[baseline!.channels[channel-1].manager])}</strong>{#if book.channels[channel-1].manager !== baseline!.channels[channel-1].manager}{' ' + $t("schedules.draftMode_c892c") + ' '}<strong>{$renderText(modeNames[book.channels[channel-1].manager])}</strong>{/if}</p></div>
          {:else}
            <div><p class="kicker">{$t("schedules.reusableProgram_65ba4")} {program || ''}</p><h2>{selected ? selected.name.trim() || $t("schedules.unnamedProgram_eba1a") : $t("schedules.noProgramSelected_4fd7c")}</h2><p>{$t("schedules.sharedByWeeklyAssignmentsChangesApplyAfterSave_334b8")}</p></div>
          {/if}
        </div>
        <div class="selectors">
          {#if view !== 'program'}
            <label>{$t("schedules.scheduleChannel_0860e")}<select bind:value={channel}>{#each book.channels as ch,i}<option value={i+1}>{channelDisplay(i+1,$savedChannels[i],'',$language)}</option>{/each}</select></label>
            <label>{$t("schedules.planningMode_20d36")}<select bind:value={book.channels[channel-1].manager}><option value={0}>{$t("schedules.noSchedule_15d88")}</option><option value={1}>{$t("schedules.daily_72829")}</option><option value={2}>{$t("schedules.weekly_158f3")}</option><option value={3}>{$t("schedules.fixedExistingValue_59fdc")}</option>{#if book.channels[channel-1].manager===4}<option value={4} disabled>{$t("schedules.otherModePreserved_71c40")}</option>{/if}</select></label>
          {:else}
            <label class="program-picker">{$t("schedules.program_9d680")}<select bind:value={program}>{#each book.programs as p}<option value={p.id}>#{p.id} {p.name}</option>{/each}</select></label>
          {/if}
        </div>
        </div>
        <div class="view-switch" role="group" aria-label={$t("schedules.scheduleView_1418a")}>{#each [['day',source("schedules.dailyCurve_e2d23")],['week',source("schedules.weeklyAssignments_539c2")],['program',source("schedules.programs_ab14d")]] as [value,label]}<button type="button" aria-pressed={view===value} onclick={()=>view=value}>{$renderText(label)}</button>{/each}</div>
        {#if view !== 'program'}
          <!-- Planning explanation is adjacent to the chart/weekly editor below. -->
        {:else}
          <div class="program-tools">
            {#if selected}<label>{$t("schedules.programName_69941")}<input type="text" bind:value={selected.name} aria-invalid={!selected.name.trim()} /></label>{/if}
            <div class="actions"><ActionButton secondary onclick={()=>addProgram()} disabled={book.lastId>=65535}>{$t("schedules.addProgram_a4366")}</ActionButton><ActionButton secondary onclick={()=>addProgram(true)} disabled={!selected||edited||book.lastId>=65535}>{$t("schedules.duplicateSavedProgram_ee107")}</ActionButton><ActionButton secondary onclick={removeProgram} disabled={!selected||referenced||rawPending}>{$t("schedules.deleteProgram_f4b7b")}</ActionButton></div>
            <p>{$t("schedules.deleteIsDisabledWhileAnyWeeklySlotReferencesThe_ce6ce")}</p>
          </div>
        {/if}
        <div class="validation" data-testid="schedule-validation" aria-live="polite">{#if errors.length}<p>{$t("schedules.correctTheseValuesBeforeSaving_75395")}</p><ul>{#each errors as error}<li>{$renderText(error)}</li>{/each}</ul>{/if}</div>
        {#if view === 'week'}
          <section class="weekly-section">
            <div class="section-title"><h2>{$t("schedules.weeklyAssignments_539c2")}</h2><span>{channelDisplay(channel,$savedChannels[channel-1],'',$language)} {$t("schedules.7DaysFallback_4af28")}</span></div>
            <p data-testid="week-help">{$t("schedules.eachWeekdayUsesItsSelectedProgramUseDefaultUses_02028")}</p>
            <div class="week-grid">{#each days as day,i}<label class:fallback={i===7}>{$renderText(day)}<select bind:value={book.channels[channel-1].week[i]}><option value={0}>{i===7?$t("schedules.noDefaultProgram_3401e"):$t("schedules.useDefault_906d2")}</option>{#each book.programs as p}<option value={p.id}>#{p.id} {p.name}</option>{/each}{#if book.channels[channel-1].week[i]!==0&&!book.programs.some(p=>p.id===book!.channels[channel-1].week[i])}<option value={book.channels[channel-1].week[i]}>{$t("schedules.unknownProgram_4e9d0")}{book.channels[channel-1].week[i]}</option>{/if}</select></label>{/each}</div>
            <p class="mode-help">{$t("schedules.dailyOrWeeklyModeActivatesThatPlanAfterSave_fef2c")}</p>
          </section>
        {:else if curve}
          <section class="curve-section">
            <div class="section-title"><h2>{view==='day'?$t("schedules.v0DailyCurve_a210b",{v0: channelDisplay(channel,$savedChannels[channel-1],'',$language)}):$t("schedules.programV0Curve_f1618",{v0: program})}</h2><span>{curve.length} {curve.length===1?$t('common.point'):$t('common.points')}</span></div>
            <a class="edit-points" href="#curve-points" onclick={e=>{e.preventDefault();document.getElementById('schedule-curve-workspace')?.scrollIntoView({block:'start'});document.querySelector<HTMLInputElement>('#curve-points input')?.focus({preventScroll:true});}}>{$t("schedules.editPoints_29d0b")}</a>{#if view==='day'}<DayCycle points={curve} baseline={savedCurve??[]} draft={curveEdited} label={book.channels[channel-1].manager===1?$t("schedules.savedDailyRhythm_48511"):$t("schedules.dailyCurveCoordinatesCheckPlanningMode_438db")} inspectable={false} compact/>{/if}<div class="curve-layout" id="schedule-curve-workspace"><div class="curve-graph" bind:this={chartElement}><SchedulePreview points={curve} {preview} valid={canShift} draft={curveEdited} selected={focusedPoint} disabled={busy} onselect={i=>focusedPoint=i} onpointchange={(i,p)=>setCurve(curve!.map((point,n)=>n===i?p:point))} /></div>
            <div class="curve-editor" id="curve-points">
            <div class="points-heading"><h3>{$t("schedules.curvePoints_df812")}</h3><p>{$t("schedules.hhMM0100SaveSortsByTime_85c4b")}</p></div>
            <div class="point-columns" aria-hidden="true"><span>#</span><span>{$t("schedules.time_6c82e")}</span><span>{$t("schedules.level_e928d")}</span><span></span></div>
            <div class="points" bind:this={pointsElement}>{#each curve as point,i}
              <div class="point" onfocusin={e=>{focusedPoint=i;queuePointReveal(e.target);}} onfocusout={()=>focusedPoint=-1}>
                <span class="point-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
                <label><span class="visually-hidden">{$t("schedules.time_6c82e")}</span><input type="text" placeholder={$t("schedules.hhMM_a4c7e")} aria-label={$t("schedules.pointV0Time_eda51",{v0: i+1})} aria-describedby={pointFeedback[i]?`point-error-${i}`:undefined} bind:value={point.time} aria-invalid={parseTime(point.time)===undefined || curve.filter(p=>p.time===point.time).length>1} spellcheck="false" /></label>
                <label><span class="visually-hidden">{$t("schedules.level_9a874")}</span><input type="number" min="0" max="100" step="1" aria-label={$t("schedules.pointV0Percent_2cb23",{v0: i+1})} aria-describedby={pointFeedback[i]?`point-error-${i}`:undefined} bind:value={point.percent} aria-invalid={!inRange(point.percent,100)} /></label>
                <ActionButton secondary label={$t("schedules.removePointV0_0b98b",{v0: i+1})} onclick={()=>setCurve(curve!.filter((_,n)=>n!==i))}>{$t("schedules.remove_e9639")}</ActionButton>
                {#if pointFeedback[i]}<p class="point-error" id={`point-error-${i}`} aria-live="polite">{$renderText(pointFeedback[i])}</p>{/if}
              </div>
            {/each}</div>
            {#if !curve.length}<p class="empty-note">{$t("schedules.noPointsAddAPointToBegin_1173c")}{view==='day'?$t("schedules.anEmptyDailyCurveIsOff_ab1df"):''}</p>{/if}
            <ActionButton secondary onclick={addPoint}>{$t("schedules.addPoint_81cb2")}</ActionButton>
            <p class="curve-help">{$t("schedules.dailyCurvesRepeatAtMidnightOnePointIsConstant_00564")}</p>
            {#if view==='day'}<p class="mode-help">{$t("schedules.dailyOrWeeklyModeActivatesThatPlanAfterSave_fef2c")}</p>{/if}
            </div></div>
          </section>
          <section class="shift-section">
            <div class="section-title"><h2>{$t("schedules.shiftThisCurve_bd312")}</h2><span>{$t("schedules.editsTheDraft_d593d")}</span></div>
            <div class="shift-grid">
              <div class="shift-group"><label>{$t("schedules.shiftMinutes_3ffd6")}<input type="number" min="1" max="720" step="1" bind:value={minutes} /></label><ActionButton secondary onclick={()=>shift(-1)} disabled={!canShift||!inRange(minutes,720)||minutes===0}>{$t("schedules.shiftEarlier_1fd55")}</ActionButton><ActionButton secondary onclick={()=>shift(1)} disabled={!canShift||!inRange(minutes,720)||minutes===0}>{$t("schedules.shiftLater_0abb6")}</ActionButton></div>
              <div class="shift-group"><label>{$t("schedules.shiftPercent_ce302")}<input type="number" min="1" max="100" step="1" bind:value={percent} /></label><ActionButton secondary onclick={()=>shift(-1,true)} disabled={!canShift||!inRange(percent,100)||percent===0}>{$t("schedules.shiftDarker_66865")}</ActionButton><ActionButton secondary onclick={()=>shift(1,true)} disabled={!canShift||!inRange(percent,100)||percent===0}>{$t("schedules.shiftBrighter_f96dc")}</ActionButton></div>
            </div><p>{$t("schedules.timeShiftsWrapAtMidnightLevelShiftsClampAt_1ac37")}</p>
          </section>
        {:else}<section class="empty-programs"><h2>{$t("schedules.noProgramsYet_17ed6")}</h2><p>{$t("schedules.addAProgramToBuildAReusableCurveFor_8deea")}</p></section>{/if}
        {#if view !== 'program'}
          <section class="copy-section"><div class="section-title"><h2>{$t("schedules.copySavedPlanFrom_c4c41")} {channelDisplay(channel,$savedChannels[channel-1],'',$language)}</h2><span>{$t("schedules.saveFirstThenCopy_4ba0b")}</span></div><p>{$t("schedules.copiesDailyPointsWeeklyAssignmentsAndPlanningModeFixed_c8408")}</p>
            <div class="targets">{#each book.channels as ch,i}<label><input type="checkbox" bind:checked={targets[i]} disabled={i===channel-1} aria-label={$t("schedules.copyTargetV0_7146e",{v0: i+1})} />{channelDisplay(i+1,$savedChannels[i],'',$language)}</label>{/each}</div>
            <ActionButton secondary onclick={copyPlan} disabled={!!edited||!!errors.length||book.channels[channel-1].manager>3||!targets.some((v,i)=>v&&i!==channel-1)}>{$t("schedules.copySavedPlan_f3250")}</ActionButton>
          </section>
        {/if}
      <ScheduleTools {book} curve={view==='week'?undefined:curve} curveKey={view==='program'?`program:${program}`:`day:${channel}`} showDaily={view!=='program'} {busy} reset={toolsReset} bind:pending={rawPending} oncurve={setCurve} onbook={next=>{book=next;onedit();}} onselect={key=>{if(key.startsWith('day:')){channel=Number(key.slice(4));view='day';}else{program=Number(key.slice(8));view='program';}}}/>
      </fieldset>
    </form></div>
  {:else}
    <div class="unavailable"><h2>{busy ? $t("schedules.loadingSchedules_8ef1a") : $t("schedules.schedulesUnavailable_c3cb0")}</h2><p>{busy ? $t("schedules.readingSavedChannelsAndProgramsFromTheDevice_d7412") : $t("schedules.checkTheConnectionAndUseReloadSchedulesToTry_0d144")}</p></div>
  {/if}
</div>

<style>
  .schedule-workspace { display:grid; grid-template-columns:148px minmax(0,1fr); gap:28px; align-items:start; }
  .channel-roster { position:sticky; top:20px; border-right:1px solid var(--sr-line); padding-right:16px; }
  .channel-roster h2 { font-size:14px; margin-bottom:16px; }
  .channel-roster button { display:flex; flex-direction:column; text-align:left; width:100%; gap:4px; min-height:60px; border:0; border-left:3px solid transparent; border-radius:4px; padding:10px; background:transparent; color:var(--sr-ink); font-size:13px; }
  .channel-roster button span { font-size:12px; color:var(--sr-muted); font-weight:400; }
  .channel-roster button[aria-pressed=true] { border-color:var(--sr-accent); background:var(--sr-soft); color:var(--sr-accent); }
  .channel-roster button:hover:not(:disabled) { background:var(--sr-surface); }
  .schedule-workspace>form { min-width:0; }
  .edit-points { display:none; }
  .schedules { color:var(--sr-ink); font-size:15px; }
  .page-heading { display:flex; align-items:center; justify-content:space-between; gap:24px; margin:20px 0 16px; }
  h1 { font-size:var(--sr-title); font-weight:600; line-height:1.2; letter-spacing:-1.2px; margin:6px 0 8px; }
  h2 { font-size:18px; line-height:1.4; letter-spacing:-.25px; margin:0; overflow-wrap:anywhere; }
  h3 { font-size:15px; margin:0; }
  p { margin:6px 0 0; color:var(--sr-muted); line-height:1.6; font-size:13px; }
  .page-heading p { font-size:14px; }
  .kicker { color:var(--sr-muted); font-size:11px; letter-spacing:1.4px; text-transform:uppercase; font-weight:650; }
  .reload { display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0; }
  small { font-size:12px; color:var(--sr-muted); }
  .editor { border:0; padding:0; margin:0; min-width:0; }
  .save-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border:0; background:var(--sr-canvas); }
  .save-bar p { font-size:12px; margin-top:4px; }
  .selectors { display:grid; grid-template-columns:minmax(160px,240px) minmax(160px,240px); gap:16px; margin:12px 0; }
  .view-switch { display:flex; gap:8px; margin:12px 0 20px; border-bottom:1px solid var(--sr-line); }
  .view-switch button { min-height:48px; padding:10px 16px; border:0; border-bottom:3px solid transparent; border-radius:0; font-size:14px; background:transparent; color:var(--sr-muted); }
  .view-switch button[aria-pressed=true] { border-color:var(--sr-accent); color:var(--sr-accent); }
  .view-switch button:hover:not(:disabled) { background:var(--sr-soft); }
  .program-picker { grid-column:span 2; }
  label { display:block; font-size:12px; font-weight:600; color:var(--sr-muted); margin:0; min-width:0; }
  input,select { min-height:44px; width:100%; min-width:0; border:1px solid var(--sr-control-line); border-radius:var(--sr-radius); color:var(--sr-ink); background:var(--sr-input); font:400 15px/1.4 var(--sr-font); padding:10px 12px; margin-top:6px; }
  select { text-overflow:ellipsis; padding-right:24px; }
  input { font-variant-numeric:tabular-nums; }
  input[aria-invalid='true'] { border-color:var(--sr-error); background:var(--sr-error-bg); }
  input:focus-visible,select:focus-visible { outline:3px solid var(--sr-focus); outline-offset:3px; }
  input:disabled,select:disabled { background:var(--sr-disabled-bg); color:var(--sr-disabled); }
  .selection-context { display:flex; gap:10px; align-items:center; margin:8px 0 12px; min-width:0; }
  .selection-context>div { min-width:0; }
  .channel-number { display:grid; place-items:center; width:28px; height:28px; flex-shrink:0; border:0; border-radius:var(--sr-radius); background:var(--sr-soft); font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
  .selection-context > div { display:flex; align-items:baseline; gap:8px 20px; flex-wrap:wrap; }
  .selection-context p strong { color:var(--sr-ink); font-weight:600; }
  .mode-help { max-width:none; margin-bottom:16px; font-size:12px; }
  .program-tools { padding:12px 0 24px; }
  .program-tools>label { max-width:640px; }
  .actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
  .validation:not(:empty) { border-left:3px solid var(--sr-error); background:var(--sr-error-bg); color:var(--sr-error); padding:12px 16px; margin:16px 0; font-size:13px; }
  .validation p { color:inherit; font-weight:600; margin:0; }
  .validation ul { margin:6px 0 0; padding-left:16px; }
  .curve-section,.weekly-section { background:var(--sr-surface); border:1px solid var(--sr-line); border-top:2px solid var(--sr-accent); border-radius:var(--sr-radius); padding:20px; }
  .section-title { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px 16px; margin-bottom:20px; }
  .section-title>span { font-size:12px; color:var(--sr-muted); }
  .curve-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:24px; align-items:start; }
  .curve-graph { position:sticky; top:112px; min-width:0; padding-top:12px; }
  .curve-editor { min-width:0; border-left:1px solid var(--sr-line); padding-left:16px; }
  .points-heading { display:flex; align-items:baseline; gap:12px; justify-content:space-between; flex-wrap:wrap; margin:0 0 4px; padding-top:0; }
  .points-heading p { font-size:12px; margin:0; }
  .points { margin-bottom:16px; max-height:356px; overflow:auto; scrollbar-gutter:stable; padding:4px; scroll-padding:8px; }
  .point,.point-columns { display:grid; grid-template-columns:20px minmax(0,1fr) minmax(0,1fr) 68px; align-items:center; gap:8px; }
  .point { padding:4px 0; border-bottom:1px solid var(--sr-line); }
  .point:focus-within { background:var(--sr-soft); box-shadow:inset 2px 0 var(--sr-accent); }
  .point-error { grid-column:2/-1; color:var(--sr-error); font-size:12px; margin:4px 0; }
  .point input { margin:0; font-family:var(--sr-mono); background:var(--sr-input); }
  .point :global(button) { padding:10px 4px; font-size:12px; }
  .point-columns { font:11px var(--sr-mono); color:var(--sr-muted); padding:16px 0 8px; border-bottom:1px solid var(--sr-control-line); }
  .point-number { align-self:center; padding:0 4px; font-family:var(--sr-mono); font-size:12px; color:var(--sr-muted); font-variant-numeric:tabular-nums; }
  .curve-help { margin-top:16px; max-width:760px; }
  .empty-note { margin:16px 0; }
  .shift-section,.copy-section { padding:24px 0; border-bottom:1px solid var(--sr-line); }
  .shift-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .shift-group { display:grid; grid-template-columns:minmax(70px,1fr) auto auto; align-items:end; gap:8px; }
  .shift-section>p { margin-top:12px; }
  .copy-section .section-title { margin-bottom:8px; }
  .targets { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:4px 12px; margin:16px 0; }
  .targets label { display:flex; align-items:center; gap:10px; min-height:44px; color:var(--sr-ink); cursor:pointer; }
  .targets input { width:18px; height:18px; min-height:0; margin:0; accent-color:var(--sr-teal); flex-shrink:0; }
  .week-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 24px; margin-top:24px; }
  .fallback { border-top:1px solid var(--sr-line); padding-top:16px; grid-column:1/-1; }
  .empty-programs,.unavailable { padding:32px 24px; background:var(--sr-surface); border:1px solid var(--sr-line); border-radius:var(--sr-radius); }
  .schedules :global(input),.schedules :global(select),.schedules :global(button) { scroll-margin-top:120px; }
  @media(max-width:1250px) { .channel-roster { display:none; } .schedule-workspace { grid-template-columns:1fr; } }
  @media(max-width:900px) { .shift-grid { grid-template-columns:1fr; } .curve-layout { grid-template-columns:1fr; gap:20px; } .curve-graph { position:static; } .curve-editor { border-left:0; border-top:1px solid var(--sr-line); padding:20px 0 0; } }
  @media(max-width:600px) {
    .save-bar { position:static; }
    .view-switch { gap:0; justify-content:space-between; } .view-switch button { padding:10px 6px; font-size:12px; }
    input,select { font-size:16px; }
    .page-heading { align-items:flex-start; gap:12px; margin:16px 0; }
    .page-heading>div:first-child { min-width:0; }
    .page-heading p { font-size:13px; }
    .reload { align-items:flex-end; max-width:132px; text-align:right; flex-shrink:1; }
    .save-bar { gap:12px; flex-wrap:wrap; padding:12px 0; }
    .save-bar>div { flex:1 1 170px; }
    .save-bar p { max-width:210px; }
    .selectors { grid-template-columns:1fr 1fr; gap:12px; margin:16px 0; }
    .selectors>label:first-child { grid-column:auto; } .edit-points { display:flex; justify-content:flex-end; align-items:center; min-height:44px; margin-bottom:12px; font-size:13px; } .curve-editor { scroll-margin-top:16px; } .points { max-height:260px; }
    .program-picker { grid-column:1/-1; }
    .curve-section,.weekly-section { padding:16px 12px; } .curve-layout { gap:12px; } .curve-graph { position:sticky; top:0; z-index:1; background:var(--sr-surface); padding-bottom:8px; } .curve-editor { padding-top:12px; }
    .point,.point-columns { grid-template-columns:20px minmax(0,1fr) minmax(0,1fr) 68px; gap:6px; }
    .point-number { display:block; font-size:11px; }
    .point :global(button) { padding:10px 4px; font-size:12px; }
    .point input { padding:10px 8px; font-size:16px; }
    .targets { grid-template-columns:1fr 1fr; }
    .week-grid { grid-template-columns:1fr; }
    .shift-group { grid-template-columns:1fr 1fr; }
    .shift-group label { grid-column:1/-1; }
    .section-title { margin-bottom:20px; }
    .schedules :global(input),.schedules :global(select),.schedules :global(button) { scroll-margin-top:180px; }
    .short-viewport .curve-graph { position:static; }
    .schedules.short-viewport :global(input),.schedules.short-viewport :global(button) { scroll-margin-top:16px; }
  }
  @media(max-height:500px) { .save-bar { position:static; } }
</style>
