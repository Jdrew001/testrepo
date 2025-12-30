import { Directive, OnInit, OnDestroy, Host, Optional, ChangeDetectorRef } from '@angular/core';
import { TableCheckbox, Table, TableService } from 'primeng/table';
import { Subscription } from 'rxjs';

/**
 * Directive to fix PrimeNG v17 TableCheckbox performance issue
 * caused by setTimeout in selection subscription.
 * 
 * Usage: Add to your p-tableCheckbox component
 * <p-tableCheckbox [value]="rowData" pFastCheckbox></p-tableCheckbox>
 */
@Directive({
  selector: 'p-tableCheckbox[pFastCheckbox]',
  standalone: true
})
export class FastTableCheckboxDirective implements OnInit, OnDestroy {
  private subscription: Subscription | undefined;
  private headerCheckboxSubscription: Subscription | undefined;
  private isHeaderCheckboxSelection = false;

  constructor(
    @Host() private checkbox: TableCheckbox,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Unsubscribe from the original slow subscription
    if ((this.checkbox as any).subscription) {
      (this.checkbox as any).subscription.unsubscribe();
    }

    if ((this.checkbox as any).tableHeaderCheckboxSubscription) {
      (this.checkbox as any).tableHeaderCheckboxSubscription.unsubscribe();
    }

    const dt = (this.checkbox as any).dt as Table;
    const tableService = (this.checkbox as any).tableService as TableService;

    // Subscribe to header checkbox selection (if available in v17)
    if ((tableService as any).isHeaderCheckboxSelection$) {
      this.headerCheckboxSubscription = (tableService as any).isHeaderCheckboxSelection$.subscribe((val: boolean) => {
        this.isHeaderCheckboxSelection = val;
      });
    }

    // Create optimized subscription WITHOUT setTimeout
    this.subscription = dt.tableService.selectionSource$.subscribe(() => {
      // Direct update without setTimeout
      const value = (this.checkbox as any).value;
      const disabled = (this.checkbox as any).disabled;
      
      (this.checkbox as any).checked = this.isHeaderCheckboxSelection
        ? dt.isSelected(value) && !disabled
        : dt.isSelected(value);

      // Update aria label
      const config = dt.config;
      if (config?.translation?.aria) {
        (this.checkbox as any).ariaLabel = (this.checkbox as any).checked
          ? config.translation.aria.selectRow
          : config.translation.aria.unselectRow;
      }

      this.cd.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.headerCheckboxSubscription) {
      this.headerCheckboxSubscription.unsubscribe();
    }
  }
}
