import {animate, style, transition, trigger} from "@angular/animations";

export const fadeAnimation: AnimationTriggerMetadata = trigger('fade', [
    transition(':enter', [
        style({ opacity: 0 }),
        animate('50ms ease-in', style({ opacity: 1 })),
    ]),
    transition(':leave', [
        animate('50ms ease-in', style({ opacity: 0 })),
    ])
])