import { Directive, Host, OnInit, OnDestroy } from '@angular/core';
import { MultiSelect } from 'primeng/multiselect';
import { ObjectUtils } from 'primeng/utils';

@Directive({
    selector: 'p-multiSelect[dataKey]'
})
export class MultiSelectDataKeyFixDirective implements OnInit, OnDestroy {
    
    private originalMethods: any = {};
    
    constructor(@Host() private multiSelect:  MultiSelect) {}
    
    ngOnInit() {
        this.patchIsSelected();
        this.patchOnOptionSelect();
        this.patchRemoveOption();
    }
    
    ngOnDestroy() {
        // Restore original methods
        Object.keys(this.originalMethods).forEach(key => {
            this.multiSelect[key] = this.originalMethods[key];
        });
    }
    
    /**
     * Fix issue #1: Selecting one selects both
     * This happens because isSelected is comparing incorrectly
     */
    private patchIsSelected() {
        this.originalMethods['isSelected'] = this.multiSelect.isSelected.bind(this.multiSelect);
        
        this.multiSelect.isSelected = (option: any): boolean => {
            const optionValue = this.multiSelect.getOptionValue(option);
            const modelValue = this.multiSelect.modelValue();
            const equalityKey = this.getEqualityKey();
            
            if (!modelValue || modelValue.length === 0) {
                return false;
            }
            
            return modelValue.some((value: any) => {
                // When using dataKey without optionValue, we need object comparison
                if (equalityKey && !this.multiSelect.optionValue) {
                    // Both should be objects
                    if (this.isObject(value) && this.isObject(optionValue)) {
                        // Compare using the dataKey field
                        return value[equalityKey] === optionValue[equalityKey];
                    }
                    // If value is primitive (shouldn't happen with dataKey), compare directly
                    return value === optionValue;
                }
                
                // Standard comparison
                return ObjectUtils.equals(value, optionValue, equalityKey);
            });
        };
    }
    
    /**
     * Fix issue #2: Returns string instead of object
     * The problem is getOptionValue returns the object, but we want to keep it
     */
    private patchOnOptionSelect() {
        this.originalMethods['onOptionSelect'] = this.multiSelect.onOptionSelect.bind(this.multiSelect);
        
        this.multiSelect.onOptionSelect = (event: any, isFocus = false, index = -1) => {
            const { originalEvent, option } = event;
            
            if (this.multiSelect.disabled || this.multiSelect.isOptionDisabled(option)) {
                return;
            }
            
            const equalityKey = this.getEqualityKey();
            const isSelected = this.multiSelect.isSelected(option);
            let value = null;
            
            // v16 behavior: When using dataKey without optionValue, work with full objects
            if (equalityKey && !this.multiSelect.optionValue) {
                if (isSelected) {
                    // Remove:  filter out object with matching dataKey
                    value = this.multiSelect.modelValue().filter((val: any) => {
                        if (this.isObject(val) && this.isObject(option)) {
                            return val[equalityKey] !== option[equalityKey];
                        }
                        return ! ObjectUtils.equals(val, option, equalityKey);
                    });
                } else {
                    // Add: append the full option object (not just the value)
                    value = [... (this.multiSelect.modelValue() || []), option];
                }
            } else {
                // Original v17 behavior for other cases
                const optionValue = this.multiSelect.getOptionValue(option);
                if (isSelected) {
                    value = this.multiSelect.modelValue().filter((val: any) => 
                        ! ObjectUtils.equals(val, optionValue, equalityKey)
                    );
                } else {
                    value = [...(this.multiSelect.modelValue() || []), optionValue];
                }
            }
            
            this.multiSelect.updateModel(value, originalEvent);
            index !== -1 && this.multiSelect.focusedOptionIndex. set(index);
            
            if (isFocus) {
                const focusInput = (this.multiSelect as any).focusInputViewChild?. nativeElement;
                if (focusInput) {
                    focusInput.focus();
                }
            }
            
            this.multiSelect.onChange. emit({
                originalEvent:  { ... event, selected: ! isSelected },
                value: value,
                itemValue: option
            });
        };
    }
    
    /**
     * Fix chip removal to work with objects
     */
    private patchRemoveOption() {
        this.originalMethods['removeOption'] = this.multiSelect.removeOption.bind(this.multiSelect);
        
        this.multiSelect.removeOption = (optionValue: any, event: any) => {
            const equalityKey = this.getEqualityKey();
            
            // v16 behavior: When using dataKey without optionValue
            if (equalityKey && ! this.multiSelect.optionValue) {
                const value = this.multiSelect.modelValue().filter((val: any) => {
                    if (this.isObject(val) && this.isObject(optionValue)) {
                        return val[equalityKey] !== optionValue[equalityKey];
                    }
                    return !ObjectUtils.equals(val, optionValue, equalityKey);
                });
                
                this.multiSelect.updateModel(value, event);
                this.multiSelect.onChange.emit({
                    originalEvent: event,
                    value:  value,
                    itemValue:  optionValue
                });
                this.multiSelect.onClear.emit();
                
                if (event) {
                    event.stopPropagation();
                }
            } else {
                // Use original method for other cases
                this.originalMethods['removeOption'](optionValue, event);
            }
        };
    }
    
    private getEqualityKey(): string | null {
        return this.multiSelect.optionValue ? null : this.multiSelect. dataKey;
    }
    
    private isObject(value:  any): boolean {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
