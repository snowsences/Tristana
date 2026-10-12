import {parseISODate} from './themes.js';
// Theme grading with a a more pronounced seasonal color balance.
// Applied at display time: the original and square JPEGs remain ungraded.
export const PHOTO_GRADES=[
  {id:'hearth',saturation:.94,contrast:.98,gain:[1.025,1,.970],lift:[.011,.008,.008]},
  {id:'hawaii',saturation:1.025,contrast:.99,gain:[.986,1.009,1.012],lift:[.006,.009,.009]},
  {id:'boreal',saturation:.93,contrast:.98,gain:[.980,1.001,1.026],lift:[.009,.012,.018]},
  {id:'cascade',saturation:.94,contrast:.99,gain:[.981,1.012,1.006],lift:[.008,.010,.009]},
  {id:'daylight',saturation:.96,contrast:.98,gain:[1.018,1.006,.982],lift:[.015,.012,.010]},
  {id:'tide-oregon',saturation:.91,contrast:.975,gain:[.975,1.004,1.019],lift:[.012,.015,.019]},
  {id:'alpine-summer',saturation:1,contrast:.99,gain:[1.003,1.011,.980],lift:[.008,.009,.007]},
  {id:'glacier-lakes',saturation:.95,contrast:.985,gain:[.974,1.012,1.023],lift:[.006,.012,.015]},
  {id:'alpine-autumn',saturation:.97,contrast:.98,gain:[1.025,1.002,.958],lift:[.012,.010,.008]},
  {id:'orchard',saturation:.94,contrast:.975,gain:[1.026,.993,.964],lift:[.015,.011,.009]},
  {id:'rainwood',saturation:.90,contrast:.98,gain:[.984,1.009,.983],lift:[.010,.012,.009]},
  {id:'alpine-winter',saturation:.94,contrast:.99,gain:[.986,1.004,1.023],lift:[.009,.010,.015]},
].map(grade=>({
  ...grade,
  saturation:Number((1+(grade.saturation-1)*4.4).toFixed(5)),
  contrast:Number((1+(grade.contrast-1)*4.4).toFixed(5)),
  gain:grade.gain.map(value=>Number((1+(value-1)*4.4).toFixed(5))),
  lift:grade.lift.map(value=>Number((value*4.4).toFixed(5))),
}));
export function photoGrade(date,themeMonth) {
  const month=themeMonth??parseISODate(date).month;
  if(!Number.isInteger(month)||month<1||month>12)throw new RangeError('Photo theme month must be 1 through 12.');
  return `url("#photo-grade-${PHOTO_GRADES[month-1].id}")`;
}
