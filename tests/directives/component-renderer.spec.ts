import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, ViewChild, QueryList } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ComponentRendererDirective } from './component-renderer.directive';
import { ChildComponentRendererDirective } from './child-component-renderer.directive';
import { LibraryConfig } from '../../model/configs/library.config';
import { BaseConfig } from '../../model/configs/base-config';
import { FieldRegistryService } from '../../services/field-registry.service';
import { CommonFormService } from '../../services/common-form.service';
import { Subject } from 'rxjs';
import { ComponentType } from '../../enums/component-type.enum';
import { DataInitializer } from '../../utils/data-initializer';

@Component({
  template: `<div componentRenderer></div>`
})
class TestHostComponent {
  @ViewChild(ComponentRendererDirective) directive!: ComponentRendererDirective;
}

describe('ComponentRendererDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let directive: ComponentRendererDirective;
  let fieldRegistryServiceSpy: jasmine.SpyObj<FieldRegistryService>;
  let commonFormServiceSpy: jasmine.SpyObj<CommonFormService>;
  let mockLibConfig: LibraryConfig;
  let mockFormConfig: BaseConfig<any>[];
  let queryList: QueryList<ChildComponentRendererDirective>;
  let factorySpy: jasmine.SpyObj<any>;
  let commonRenderServiceSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockLibConfig = { name: 'Test Config' } as LibraryConfig;
    mockFormConfig = [
      { field: 'field1', componentType: ComponentType.TEXT, editable: true } as BaseConfig<any>,
      { field: 'field2', componentType: ComponentType.DROPDOWN } as BaseConfig<any>
    ];

    fieldRegistryServiceSpy = jasmine.createSpyObj('FieldRegistryService', 
      ['register', 'addFormControl', 'addToParentForm'], 
      { initializedDatas: new Subject<any>() }
    );
    
    commonFormServiceSpy = jasmine.createSpyObj('CommonFormService', ['registerFormElement']);
    
    factorySpy = jasmine.createSpyObj('factory', ['getStrategy']);
    
    commonRenderServiceSpy = jasmine.createSpyObj('CommonRenderService', 
      ['getComponentForField', 'getComponentByComponentType']);
    
    // Create mock implementation for getStrategy
    factorySpy.getStrategy.and.returnValue({
      id: 'testId',
      libraryConfig: null,
      formGroup: null,
      control: { value: null },
      config: { editable: false },
      updateEnabledDisableState: jasmine.createSpy('updateEnabledDisableState'),
      updateValidators: jasmine.createSpy('updateValidators')
    });

    // Initialize mock QueryList
    queryList = new QueryList<ChildComponentRendererDirective>();
    
    spyOn(console, 'log');

    TestBed.configureTestingModule({
      declarations: [
        ComponentRendererDirective,
        TestHostComponent
      ],
      providers: [
        { provide: FieldRegistryService, useValue: fieldRegistryServiceSpy },
        { provide: CommonFormService, useValue: commonFormServiceSpy }
      ]
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    directive = component.directive;

    // Set private properties on directive
    directive['factory'] = factorySpy;
    directive['commonRenderService'] = commonRenderServiceSpy;
    directive.children = queryList;
  });

  it('should create an instance', () => {
    expect(directive).toBeTruthy();
  });

  describe('Input properties', () => {
    it('should set and get libConfig', () => {
      directive.libConfig = mockLibConfig;
      expect(directive.libConfig).toBe(mockLibConfig);
    });

    it('should set and get parentForm', () => {
      const formGroup = new FormGroup({});
      directive.parentForm = formGroup;
      expect(directive.parentForm).toBe(formGroup);
    });

    it('should set formConfig and call initializeFields', () => {
      spyOn(directive as any, 'initializeFields');
      directive.formConfig = mockFormConfig;
      expect(directive.formConfig).toBe(mockFormConfig);
      expect(directive['initializeFields']).toHaveBeenCalledWith(mockFormConfig);
    });

    it('should set and get data', () => {
      const testData = { test: 'data' };
      directive.data = testData;
      expect(directive.data).toBe(testData);
    });
  });

  describe('childRendererDirective', () => {
    it('should get the first child directive', () => {
      const mockChild = new ChildComponentRendererDirective();
      Object.defineProperty(mockChild, 'viewContainerRef', { value: { clear: jasmine.createSpy('clear') } });
      queryList.reset([mockChild]);
      queryList.notifyOnChanges();

      expect(directive.childRendererDirective).toBe(mockChild);
    });
  });

  describe('componentRef', () => {
    it('should return viewContainerRef if childRendererDirective exists', () => {
      const mockChild = new ChildComponentRendererDirective();
      const mockViewContainerRef = { clear: jasmine.createSpy('clear') };
      Object.defineProperty(mockChild, 'viewContainerRef', { value: mockViewContainerRef });
      queryList.reset([mockChild]);
      queryList.notifyOnChanges();

      expect(directive.componentRef).toBe(mockViewContainerRef);
    });

    it('should return this if childRendererDirective does not exist', () => {
      queryList.reset([]);
      queryList.notifyOnChanges();

      expect(directive.componentRef).toBe(directive);
    });
  });

  describe('ngOnInit', () => {
    it('should subscribe to fieldRegistry.initializedDatas', () => {
      directive.ngOnInit();
      
      // Trigger the subscription
      fieldRegistryServiceSpy.initializedDatas.next({ test: 'data' });
      
      expect(console.log).toHaveBeenCalledWith('handle field', jasmine.any(Object));
    });
  });

  describe('initializeFields', () => {
    it('should call getUIVariant and componentRef.clear', fakeAsync(() => {
      const clearSpy = jasmine.createSpy('clear');
      spyOn(directive, 'getUIVariant');
      spyOn(directive, 'componentRef').and.returnValue({ clear: clearSpy });
      
      directive['initializeFields'](mockFormConfig);
      tick(); // Wait for async operations
      
      expect(directive.getUIVariant).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    }));

    it('should call createFields with formConfig', fakeAsync(() => {
      spyOn(directive, 'componentRef').and.returnValue({ clear: jasmine.createSpy('clear') });
      spyOn(directive as any, 'createFields');
      
      directive['initializeFields'](mockFormConfig);
      tick(); // Wait for async operations
      
      expect(directive['createFields']).toHaveBeenCalledWith(mockFormConfig);
    }));
  });

  describe('createFields', () => {
    it('should process each form config and create fields', fakeAsync(() => {
      const mockField = {
        id: 'testId',
        config: { editable: true },
        libraryConfig: null,
        formGroup: null,
        control: {},
        updateEnabledDisableState: jasmine.createSpy('updateEnabledDisableState'),
        updateValidators: jasmine.createSpy('updateValidators')
      };
      
      factorySpy.getStrategy.and.returnValue(mockField);
      spyOn(directive as any, 'renderComponent');
      
      directive['createFields'](mockFormConfig);
      tick(); // Wait for async operations
      
      expect(factorySpy.getStrategy).toHaveBeenCalledTimes(mockFormConfig.length);
      expect(fieldRegistryServiceSpy.register).toHaveBeenCalledWith(mockField);
      expect(commonFormServiceSpy.registerFormElement).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(Object), null);
      expect(directive['renderComponent']).toHaveBeenCalledWith(mockField);
    }));
  });

  describe('initializeData', () => {
    it('should call DataInitializer.initializeData', () => {
      spyOn(DataInitializer, 'initializeData');
      const testData = { test: 'data' };
      const fields = new Map();
      
      directive['initializeData'](testData);
      
      expect(DataInitializer.initializeData).toHaveBeenCalledWith(testData, jasmine.any(Object));
    });
  });

  describe('handleOutputChanges', () => {
    it('should log and update dependency', () => {
      spyOn(directive as any, 'updateDependency');
      spyOn(directive['outForms'], 'emit');
      
      const field = { id: 'testField' };
      const data = { value: 'test' };
      
      directive['handleOutputChanges'](field, data);
      
      expect(console.log).toHaveBeenCalledWith('handle field', field);
      expect(directive['updateDependency']).toHaveBeenCalledWith(field, data);
      expect(directive['outForms'].emit).toHaveBeenCalledWith({ field, data });
    });
  });
});