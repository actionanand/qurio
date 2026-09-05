import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import {
  arrowBackOutline,
  arrowForwardOutline,
  bookOutline,
  bulbOutline,
  calculatorOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeCircleOutline,
  colorPaletteOutline,
  documentTextOutline,
  flaskOutline,
  globeOutline,
  languageOutline,
  playOutline,
  schoolOutline,
  sparklesOutline,
  statsChartOutline,
  timerOutline,
  trophyOutline,
} from 'ionicons/icons';

const icons = {
  back: arrowBackOutline,
  forward: arrowForwardOutline,
  book: bookOutline,
  bulb: bulbOutline,
  mathematics: calculatorOutline,
  correct: checkmarkCircleOutline,
  chevron: chevronForwardOutline,
  wrong: closeCircleOutline,
  appearance: colorPaletteOutline,
  note: documentTextOutline,
  science: flaskOutline,
  'social-studies': globeOutline,
  english: languageOutline,
  language: languageOutline,
  play: playOutline,
  grade: schoolOutline,
  intelligence: sparklesOutline,
  progress: statsChartOutline,
  quiz: timerOutline,
  trophy: trophyOutline,
  syllabus: bookOutline,
};
@Component({
  selector: 'app-icon',
  imports: [IonIcon],
  host: { 'aria-hidden': 'true' },
  template: '<ion-icon [icon]="icons[name()]" aria-hidden="true" />',
  styles:
    ':host { display: inline-flex; flex: 0 0 auto; align-items: center; font-size: 1.3em; vertical-align: middle; } ion-icon { display: block; }',
})
export class IconComponent {
  readonly name = input.required<keyof typeof icons>();
  readonly icons = icons;
}
