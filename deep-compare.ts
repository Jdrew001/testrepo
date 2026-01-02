import { Directive, Input, Optional, OnInit, OnDestroy } from '@angular/core';
import { NgModel } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { Subject, takeUntil } from 'rxjs';

@Directive({
  selector: 'p-multiSelect[dataKey][ngModel]',
  standalone: true // Remove this if not using standalone components
})
export class MultiSelectDeepCompareDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isNormalizing = false;

  constructor(
    @Optional() private multiSelect: MultiSelect,
    @Optional() private ngModel: NgModel
  ) {}

  ngOnInit() {
    if (!this.multiSelect || !this. ngModel) {
      return;
    }

    // Normalize initial selection
    this.normalizeSelection();

    // Watch for value changes from outside (programmatic changes)
    this.ngModel.valueChanges
      ?.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (! this.isNormalizing) {
          this.normalizeSelection();
        }
      });

    // Watch for options changes
    const originalWriteValue = this.multiSelect.writeValue. bind(this.multiSelect);
    this.multiSelect.writeValue = (value: any) => {
      originalWriteValue(value);
      if (! this.isNormalizing) {
        this.normalizeSelection();
      }
    };
  }

  private normalizeSelection() {
    if (! this.multiSelect. dataKey || !this.multiSelect.options) {
      return;
    }

    const currentValue = this.ngModel.value;
    
    if (! Array.isArray(currentValue) || currentValue.length === 0) {
      return;
    }

    this.isNormalizing = true;

    // Map selected items to matching references from options
    const normalizedValue = currentValue
      .map(selectedItem => {
        if (!selectedItem) return null;
        
        const dataKeyValue = selectedItem[this.multiSelect.dataKey! ];
        
        return this.multiSelect.options! .find(
          option => option[this.multiSelect. dataKey! ] === dataKeyValue
        ) || selectedItem; // Keep original if not found
      })
      .filter(item => item !== null);

    // Only update if references actually changed
    const hasChanges = normalizedValue.some(
      (item, index) => item !== currentValue[index]
    );

    if (hasChanges) {
      this.ngModel.control. setValue(normalizedValue, { emitEvent: false });
    }

    this.isNormalizing = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
