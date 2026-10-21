import {source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
// Local workflow reference. Links navigate only; none perform writes.
export const helpSections=[
 {name:source("lightingdashboard.channels_18e03"),route:'channels',text:[source("help-content.reportedChannelOutputIsAnIndependentRawCountNormally_4fe50"),source("help-content.configureChannelsLoadsSavedColourPresetsAndBinaryOn_8f07e"),source("help-content.reviewEveryExpandedChannelBeforeSaveCrossingBetweenPump_48635"), source("help-content.rawCommandsOnFixedModeChannelsPersistTheFixed_01977")]},
 {name:source("help-content.serviceAndBlackout_51b7a"),route:'service',text:[source("help-content.startStopAreOperationalCommandsSeparateFromSaveSettings_cd391"),source("help-content.blackoutTurnsOffParticipatingOutputsIncludingBinaryChannelsWhile_319e2"),source("help-content.offReadbackCanPrecedeCompletionOfAFadeOut_3ad70")]},
 {name:source("schedules.schedules_26d9d"),route:'schedules',text:[source("help-content.dailyCurvesRepeatInDeviceLocalTimeEmptyDaily_7acda"),source("help-content.chooseAChannelAndPlanningModeEditUniqueHH_da759"),source("help-content.saveSchedulesAppliesAllEditedChannelsAndProgramsAnd_876ca"),source("help-content.singleCurveShiftsAndSelectedDailyChannelShiftsWrap_bc33b")]},
 {name:source("lightingtools.lightingTools_601b5"),route:'lighting-tools',text:[source("help-content.timeLapseTemporarilyAcceleratesPlanningAndBypassesWeatherEffects_800e3"),source("help-content.minimumSettingsUse01000Raw0DisablesThe_ec467"),source("help-content.expertDimmingProvidesTheExistingHigherMinimumOriginalAlgorithm_e6948")]},
 {name:source("weather.weather_284af"),route:'weather',text:[source("help-content.selectOrCreateAProfileEditItsSupportedEffects_52092"),source("help-content.reportedWeatherRuntimeIsReadOnlyOnRequestIndependently_b1de5")]},
 {name:source("sensors.sensors_711bf"),route:'sensors',text:[source("help-content.connectedReadingsAreDeviceReportsMissingDisconnectedSensorsDo_17501"),source("help.sensorRemoval"),source("help-content.binaryChannelResponsesUseOffOnRulesRatherThan_63cc2"),source("help-content.knownFirmwareLimitationChangingActiveMonthsCanRetainEarlier_3a72f")]},
 {name:source("app.settings_c7f73"),route:'settings',text:[source("help-content.hostnameAndDevicePreferencesHaveIndependentSaveActionsFollow_c0055"),source("help-content.physicalButtonActionsIncludeServiceThunderAndBlackoutWith_d7dbc"),source("help-content.errorInfoLoggingControlsFutureRecordsExistingLogsRemain_6be8e")]},
 {name:source("help-content.clock_04f6b"),route:'clock',text:[source("help-content.deviceUTCDeviceLocalTimeAndTimezoneConfigurationAre_db09d"),source("help-content.clockCommandsAndTimezoneSaveRemainSeparateExplicitOperations_9e0c3")]},
 {name:source("help.network_53ebc"),route:'network',text:[source("help-content.reportedAddressesAreSeparateFromEditableNetworkServiceLAN_1c89a"),source("help-content.staticWiFiFieldsCurrentlyHaveStorageOnlyQualification_53631")]},
 {name:source("diagnostics.diagnostics_3af22"),route:'diagnostics',text:[source("help-content.refreshDiagnosticsExplicitlyReadsFirmwareStateAndOptionalBootloader_33a0e"),source("help-content.downloadErrorInfoLogRetrievesTheExistingLocalFile_0e809")]},
 {name:source("help.recovery_ea924"),route:'recovery',text:[source("help-content.downloadBackupsBeforeMakingRecoveryChangesRestoreFirmwareFactory_da0c5"),source("help-content.restoreMergesSuppliedKeysLocalFirmwareUploadUsesChecked_2dd51"),source("help-content.afterAnInterruptedOrUncertainOperationDoNotAssume_9bf88"),source("help-content.bootloaderCreatedFactoryBackupAvailabilityARMExecutionAfterUpdate_bc382")]}
];
