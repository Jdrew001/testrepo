import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgAccordionTabComponent } from './ng-accordion-tab.component';
import { BaseComponent } from './base.component';
import { FormGroup } from '@angular/forms';
import { AccordionTabStrategy } from './accordion-tab-strategy';
import { ViewContainerRef } from '@angular/core';

describe('NgAccordionTabComponent', () => {
  let component: NgAccordionTabComponent;
  let fixture: ComponentFixture<NgAccordionTabComponent>;
  let mockViewContainerRef: jasmine.SpyObj<ViewContainerRef>;
  let mockStrategy: jasmine.SpyObj<AccordionTabStrategy>;

  beforeEach(async () => {
    mockViewContainerRef = jasmine.createSpyObj('ViewContainerRef', ['clear', 'createEmbeddedView']);
    mockStrategy = jasmine.createSpyObj('AccordionTabStrategy', 
      ['config', 'childFormConfig', 'refData', 'control', 'initializeField'],
      {
        'config': {
          customAttributes: { test: 'value' },
          displayName: 'Test Accordion'
        },
        'childFormConfig': {},
        'refData': { refData: 'test' },
        'control': new FormGroup({})
      });

    await TestBed.configureTestingModule({
      declarations: [ NgAccordionTabComponent ],
      providers: [
        { provide: ViewContainerRef, useValue: mockViewContainerRef }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgAccordionTabComponent);
    component = fixture.componentInstance;
    component.strategy = mockStrategy;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getters', () => {
    it('should return config from strategy', () => {
      expect(component.config).toBe(mockStrategy.config);
    });

    it('should return formConfig from accStrategy', () => {
      expect(component.formConfig).toBe(mockStrategy.childFormConfig);
    });

    it('should return customAttributes from config', () => {
      expect(component.customAttributes).toEqual({ test: 'value' });
    });

    it('should return displayName from config', () => {
      expect(component.displayName).toBe('Test Accordion');
    });

    it('should return refData from strategy', () => {
      expect(component.refData).toBe(mockStrategy.refData);
    });

    it('should return accStrategy from strategy', () => {
      expect(component.accStrategy).toBe(mockStrategy);
    });

    it('should return control from accStrategy', () => {
      expect(component.control).toBe(mockStrategy.control);
    });

    it('should return empty object for data', () => {
      expect(component.data).toEqual({});
    });
  });

  describe('lifecycle methods', () => {
    it('should call initializeField on accStrategy in ngOnInit', () => {
      component.ngOnInit();
      expect(mockStrategy.initializeField).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('should emit gridAction$ when event occurs', () => {
      spyOn(component.gridAction$, 'emit');
      const testEvent = { type: 'click' };
      component.handleOutForm(testEvent);
      expect(component.gridAction$.emit).toHaveBeenCalledWith(testEvent);
    });

    it('should log to console in handleOutForm', () => {
      spyOn(console, 'log');
      const testEvent = { type: 'click' };
      component.handleOutForm(testEvent);
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('integration with BaseComponent', () => {
    it('should properly extend BaseComponent', () => {
      expect(component instanceof BaseComponent).toBe(true);
    });

    it('should have all properties and methods from BaseComponent', () => {
      expect(component.outForm$).toBeDefined();
      expect(component.outClick$).toBeDefined();
      expect(typeof component.strategy).toBe('object');
      expect(typeof component.handleOutput).toBe('function');
      expect(typeof component.form).toBe('function');
    });
  });

  describe('container integration', () => {
    it('should have a valid containerRef', () => {
      expect(component.container).toBe(mockViewContainerRef);
    });
  });
});

// Tests for the BaseComponent
describe('BaseComponent', () => {
  let mockStrategy: any;
  let component: TestBaseComponent;

  // Test implementation of BaseComponent
  class TestBaseComponent extends BaseComponent {
    // Required implementation
    constructor() {
      super();
    }
  }

  beforeEach(() => {
    mockStrategy = jasmine.createSpyObj('IGenericStrategyInterface', 
      ['formGroup'],
      { 'formGroup': new FormGroup({}) });
    
    component = new TestBaseComponent();
    component.strategy = mockStrategy;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize EventEmitters', () => {
    expect(component.outForm$).toBeDefined();
    expect(component.outClick$).toBeDefined();
    expect(component.outForm$ instanceof EventEmitter).toBe(true);
    expect(component.outClick$ instanceof EventEmitter).toBe(true);
  });

  it('should get and set strategy correctly', () => {
    const newMockStrategy = jasmine.createSpyObj('IGenericStrategyInterface', ['formGroup']);
    component.strategy = newMockStrategy;
    expect(component.strategy).toBe(newMockStrategy);
  });

  it('should return formGroup from strategy', () => {
    expect(component.form()).toBe(mockStrategy.formGroup);
  });

  it('should emit event in handleOutput', () => {
    spyOn(component.outForm$, 'emit');
    const testEvent = { type: 'test' };
    component.handleOutput(testEvent);
    expect(component.outForm$.emit).toHaveBeenCalledWith(testEvent);
  });
});