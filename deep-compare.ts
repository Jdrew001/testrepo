import { Directive, Input, Optional, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { NgModel } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { Subject, takeUntil, debounceTime } from 'rxjs';

@Directive({
  selector: 'p-multiSelect[dataKey][ngModel]',
  standalone: true // Remove this if not using standalone components
})
export class MultiSelectDeepCompareDirective implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isNormalizing = false;
  private pendingValue: any[] | null = null;

  constructor(
    @Optional() private multiSelect: MultiSelect,
    @Optional() private ngModel: NgModel
  ) {}

  ngOnInit() {
    if (!this.multiSelect || !this. ngModel) {
      return;
    }

    // Store the initial value
    this.pendingValue = this.ngModel. value;

    // Watch for value changes from outside (programmatic changes)
    this.ngModel.valueChanges
      ?. pipe(
        takeUntil(this.destroy$),
        debounceTime(0)
      )
      .subscribe(() => {
        if (!this.isNormalizing) {
          setTimeout(() => this.normalizeSelection(), 0);
        }
      });
  }

  ngAfterViewInit() {
    // Normalize after view is initialized and options are likely loaded
    setTimeout(() => {
      this.normalizeSelection();
      this.watchForOptionsChanges();
    }, 0);
  }

  private watchForOptionsChanges() {
    // Watch for options being set or changed
    let lastOptions = this.multiSelect?. options;
    
    const checkInterval = setInterval(() => {
      if (this.multiSelect?.options && this.multiSelect. options !== lastOptions) {
        lastOptions = this.multiSelect.options;
        this.normalizeSelection();
      }
    }, 100);

    // Clean up after 5 seconds (options should be loaded by then)
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  private normalizeSelection() {
    if (!this.multiSelect?.dataKey || !this.multiSelect?.options) {
      return;
    }

    const currentValue = this. pendingValue || this.ngModel.value;
    this.pendingValue = null;

    if (! Array.isArray(currentValue) || currentValue.length === 0) {
      return;
    }

    // Check if options are actually loaded
    if (! this.multiSelect.options || this.multiSelect.options.length === 0) {
      this.pendingValue = currentValue;
      return;
    }

    this.isNormalizing = true;

    const dataKey = this.multiSelect.dataKey;

    // Map selected items to matching references from options
    const normalizedValue = currentValue
      .map(selectedItem => {
        if (! selectedItem) return null;

        const dataKeyValue = selectedItem[dataKey];

        const matchedOption = this.multiSelect.options! .find(
          option => option[dataKey] === dataKeyValue
        );

        return matchedOption || selectedItem; // Keep original if not found
      })
      .filter(item => item !== null);

    // Update the model and the MultiSelect component
    if (normalizedValue.length > 0) {
      this.ngModel.control.setValue(normalizedValue, { emitEvent: false });
      
      // Also update the MultiSelect's internal value
      if (this.multiSelect.value !== normalizedValue) {
        this.multiSelect.value = normalizedValue;
        this.multiSelect.updateLabel();
        this.multiSelect.cd?. markForCheck();
      }
    }

    this.isNormalizing = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
