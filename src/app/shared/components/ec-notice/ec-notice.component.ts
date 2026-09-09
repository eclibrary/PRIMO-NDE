import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AssetsPublicPathDirective } from '../../../services/assets-public-path.directive';
import { AuthStateService } from '../../auth-state.service';

/**
 * Example shared component. Demonstrates the things most custom components
 * need: host component access, auth state (via AuthStateService, which wraps
 * the shell's NGRX `user.isLoggedIn`), and asset paths.
 * Currently NOT mapped (see shared-mappings.ts); kept as a reference.
 */
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

  private readonly auth = inject(AuthStateService);
  isLoggedIn = this.auth.isSignedIn;
}
