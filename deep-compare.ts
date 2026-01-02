import { Directive, Host, OnInit, OnDestroy } from '@angular/core';
import { MultiSelect } from 'primeng/multiselect';
import { ObjectUtils } from 'primeng/utils';

@Directive({
    selector: 'p-multiSelect[dataKey]'
})
export class MultiSelectDataKeyFixDirective implements OnInit, OnDestroy {
    
    private originalMethods: any = {};
    
    constructor(@Host() private multiSelect: MultiSelect) {}
    
    ngOnInit() {
        // Only apply fix if dataKey is set WITHOUT optionValue
        if (!this.multiSelect.dataKey || this.multiSelect.optionValue) {
            return;
        }
        
        this.patchIsSelected();
        this.patchOnOptionSelect();
        this.patchRemoveOption();
        this.patchEqualityKey();
    }
    
    ngOnDestroy() {
        Object.keys(this.originalMethods).forEach(key => {
            this.multiSelect[key] = this.originalMethods[key];
        });
    }
    
    /**
     * Core fix: Make isSelected compare objects by dataKey
     */
    private patchIsSelected() {
        this.originalMethods['isSelected'] = this.multiSelect.isSelected.bind(this.multiSelect);
        
        this.multiSelect.isSelected = (option: any): boolean => {
            const modelValue = this.multiSelect.modelValue();
            
            if (!modelValue || modelValue.length === 0) {
                return false;
            }
            
            const dataKey = this.multiSelect.dataKey;
            const optionKey = option? .[dataKey];
            
            if (optionKey === undefined) {
                return false;
            }
            
            // Compare by dataKey field
            return modelValue.some((value: any) => {
                return value? .[dataKey] === optionKey;
            });
        };
    }
    
    /**
     * Fix selection/deselection to work with full objects
     */
    private patchOnOptionSelect() {
        this.originalMethods['onOptionSelect'] = this.multiSelect. onOptionSelect.bind(this. multiSelect);
        
        this.multiSelect.onOptionSelect = (event: any, isFocus = false, index = -1) => {
            const { originalEvent, option } = event;
            
            if (this.multiSelect. disabled || this.multiSelect.isOptionDisabled(option)) {
                return;
            }
            
            const dataKey = this.multiSelect.dataKey;
            const isCurrentlySelected = this.multiSelect.isSelected(option);
            let newValue: any[];
            
            if (isCurrentlySelected) {
                // Remove: filter out the object with matching dataKey
                newValue = (this.multiSelect.modelValue() || []).filter((val: any) => {
                    return val?.[dataKey] !== option?.[dataKey];
                });
                
                // Emit remove event
                if ((this.multiSelect as any).onRemove) {
                    (this.multiSelect as any).onRemove. emit({
                        originalEvent:  originalEvent,
                        value:  newValue,
                        itemValue: option
                    });
                }
            } else {
                // Add: append the full option object
                newValue = [... (this.multiSelect.modelValue() || []), option];
            }
            
            // Update model
            this.multiSelect. updateModel(newValue, originalEvent);
            
            // Update focused index
            if (index !== -1) {
                this.multiSelect.focusedOptionIndex.set(index);
            }
            
            // Focus input if needed
            if (isFocus) {
                const focusInput = (this.multiSelect as any).focusInputViewChild?. nativeElement;
                if (focusInput) {
                    focusInput.focus();
                }
            }
            
            // Emit change event
            this.multiSelect.onChange.emit({
                originalEvent: originalEvent,
                value: newValue,
                itemValue: option
            });
            
            // Mark for check to update UI
            this.multiSelect.cd.markForCheck();
        };
    }
    
    /**
     * Fix chip/token removal
     */
    private patchRemoveOption() {
        this.originalMethods['removeOption'] = this.multiSelect.removeOption. bind(this.multiSelect);
        
        this.multiSelect. removeOption = (optionValue:  any, event: any) => {
            const dataKey = this. multiSelect.dataKey;
            
            const newValue = (this.multiSelect. modelValue() || []).filter((val: any) => {
                return val?.[dataKey] !== optionValue?.[dataKey];
            });
            
            this.multiSelect.updateModel(newValue, event);
            
            this.multiSelect.onChange.emit({
                originalEvent: event,
                value: newValue,
                itemValue: optionValue
            });
            
            this.multiSelect.onClear.emit();
            
            if (event) {
                event.stopPropagation();
            }
            
            this.multiSelect.cd.markForCheck();
        };
    }
    
    /**
     * Ensure equalityKey returns dataKey for proper ObjectUtils. equals behavior
     */
    private patchEqualityKey() {
        // Store original if it exists
        const multiSelectAny = this.multiSelect as any;
        if (multiSelectAny.equalityKey) {
            this. originalMethods['equalityKey'] = multiSelectAny.equalityKey.bind(this.multiSelect);
        }
        
        // Override to always return dataKey when no optionValue
        multiSelectAny.equalityKey = () => {
            return this.multiSelect.optionValue ? null : this.multiSelect.dataKey;
        };
    }
}
