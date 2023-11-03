import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSelectorComponent implements OnInit {
  themeForm: UntypedFormGroup;
  themes = ['default', 'contrast'];

  constructor(
    private formBuilder: UntypedFormBuilder,
    private themeService: ThemeService,
  ) { }

  ngOnInit() {
    this.themeForm = this.formBuilder.group({
      theme: ['default']
    });
    this.themeForm.get('theme')?.setValue(this.themeService.theme);
  }

  changeTheme() {
    const newTheme = this.themeForm.get('theme')?.value;
    this.themeService.apply(newTheme);
  }
}
