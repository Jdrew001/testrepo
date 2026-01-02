import { 
  Directive, 
  Optional, 
  OnInit, 
  OnDestroy, 
  AfterViewInit,
  DoCheck
} from '@angular/core';
import { NgModel } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { Subject, takeUntil } from 'rxjs';

@Directive({
  selector: 'p-multiSelect[dataKey][ngModel]',
  standalone: true
})
export class MultiSelectDeepCompareDirective implements OnInit, AfterViewInit, OnDestroy, DoCheck {
  private destroy$ = new Subject<void>();
  private isNormalizing = false;
  private lastOptionsLength = 0;
  private initialNormalizationDone = false;

  constructor(
    @Optional() private multiSelect: MultiSelect,
    @Optional() private ngModel: NgModel
  ) {}

  ngOnInit() {
    if (!this.multiSelect || !this.ngModel) {
      return;
    }

    // Watch for value changes
    this.ngModel.valueChanges
      ?.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.isNormalizing) {
          setTimeout(() => this.normalizeSelection(), 0);
        }
      });
  }

  ngAfterViewInit() {
    // Initial normalization after view init
    setTimeout(() => {
      this.normalizeSelection();
      this.initialNormalizationDone = true;
    }, 0);
  }

  ngDoCheck() {
    // Check if options have been loaded or changed
    const currentOptionsLength = this.multiSelect?. options?.length || 0;
    
    if (currentOptionsLength !== this.lastOptionsLength) {
      this.lastOptionsLength = currentOptionsLength;
      
      if (currentOptionsLength > 0) {
        setTimeout(() => this.normalizeSelection(), 0);
      }
    }
  }

  private normalizeSelection() {
    if (!this.multiSelect?.dataKey || !this. ngModel) {
      return;
    }

    const options = this.multiSelect.options;
    const currentValue = this.ngModel.value;

    if (! options || options.length === 0) {
      return;
    }

    if (! Array.isArray(currentValue) || currentValue.length === 0) {
      return;
    }

    this.isNormalizing = true;

    const dataKey = this.multiSelect.dataKey;
    const normalizedValue:  any[] = [];

    // Create a map for faster lookup
    const optionsMap = new Map(
      options.map(option => [option[dataKey], option])
    );

    // Match selected items with options
    for (const selectedItem of currentValue) {
      if (!selectedItem) continue;

      const dataKeyValue = selectedItem[dataKey];
      const matchedOption = optionsMap.get(dataKeyValue);

      if (matchedOption) {
        normalizedValue.push(matchedOption);
      }
    }

    // Only update if we found matches
    if (normalizedValue.length > 0) {
      const hasChanges = normalizedValue. some(
        (item, index) => item !== currentValue[index]
      );

      if (hasChanges || !this.initialNormalizationDone) {
        // Update NgModel
        this.ngModel.control. setValue(normalizedValue, { emitEvent: false });

        // Trigger change detection on MultiSelect
        this.multiSelect.value = normalizedValue;
        
        // Use ChangeDetectorRef if available
        if (this.multiSelect.cd) {
          this.multiSelect.cd.detectChanges();
        }
      }
    }

    this. isNormalizing = false;
  }

  ngOnDestroy() {
    this.destroy$. next();
    this.destroy$. complete();
  }
}
