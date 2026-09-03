import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AssetsPublicPathDirective } from '../../../services/assets-public-path.directive';

/**
 * Example shared component. Demonstrates the three things most custom
 * components need: host component access, NGRX store access, and asset paths.
 * Replace with real shared components (header, Ask-a-Librarian, ...).
 */
const selectUser = createFeatureSelector<{ isLoggedIn: boolean }>('user');
const selectIsLoggedIn = createSelector(selectUser, (s) => s?.isLoggedIn ?? false);

@Component({
  selector: 'custom-ec-notice',
  standalone: true,
  imports: [CommonModule, TranslateModule, AssetsPublicPathDirective],
  host: { 'data-component-id': 'custom-ec-notice' },
  templateUrl: './ec-notice.component.html',
  styleUrls: ['./ec-notice.component.scss'],
})
export class EcNoticeComponent {
  /** Instance of the NDE component this one is hooked to (injected by the shell). */
  @Input() hostComponent: any;

  private store = inject(Store);
  isLoggedIn = this.store.selectSignal(selectIsLoggedIn);
}
