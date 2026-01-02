import { Directive, Host, OnInit } from '@angular/core';
import { MultiSelect } from 'primeng/multiselect';
import { ObjectUtils } from 'primeng/utils';

@Directive({
    selector: 'p-multiSelect[dataKey]'  // Only applies when dataKey is used
})
export class MultiSelectDataKeyFixDirective implements OnInit {
    
    constructor(@Host() private multiSelect: MultiSelect) {}
    
    ngOnInit() {
        // Store original method
        const originalIsSelected = this.multiSelect.isSelected. bind(this.multiSelect);
        
        // Override with v16 behavior
        this.multiSelect.isSelected = (option: any): boolean => {
            const optionValue = this.multiSelect.getOptionValue(option);
            const modelValue = this.multiSelect.modelValue();
            const equalityKey = this.getEqualityKey();
            
            if (! modelValue || modelValue.length === 0) {
                return false;
            }
            
            return modelValue.some((value: any) => {
                // v16 behavior: When dataKey is set without optionValue,
                // compare objects by the dataKey field
                if (equalityKey && !this.multiSelect.optionValue) {
                    // Both are objects - compare by dataKey
                    if (typeof value === 'object' && value !== null && 
                        typeof optionValue === 'object' && optionValue !== null) {
                        return value[equalityKey] === optionValue[equalityKey];
                    }
                }
                
                // Fall back to ObjectUtils.equals for other cases
                return ObjectUtils.equals(value, optionValue, equalityKey);
            });
        };
    }
    
    private getEqualityKey(): string | null {
        return this.multiSelect.optionValue ? null : this.multiSelect.dataKey;
    }
}
