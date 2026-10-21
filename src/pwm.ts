// SPDX-License-Identifier: GPL-3.0-or-later
// SR8/SR10, firmware1.006/1.007: pwm.h and pwm.c. These are not optical units.
export const PWM_RAW_MAX = 1024;
export const PWM_DEFAULT_DIMMER_MAX = 1000;
export const validRawCommand = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= PWM_RAW_MAX;
export const rawMeterPercent = (value: number) => Math.max(0, Math.min(PWM_RAW_MAX, value)) / PWM_RAW_MAX * 100;
