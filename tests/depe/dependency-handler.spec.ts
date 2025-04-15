import { TestBed } from '@angular/core/testing';
import { DependencyHandlerService } from './dependency-handler.service';
import { ConditionStrategyFactory } from './factory/condition-strategy.factory';
import { EventBusService } from '../services/infrastructure/event-bus.service';
import { FieldRegistryService } from '../services/form/field-registry.service';
import { Behavior, DependencyConfig, DependencyBaseCustomAttributes } from '../model/configs/dependency.config';
import { IGenericStrategyInterface } from '../strategy/field-strategies/generic-strategy.interface';
import { HashObject } from '../utils/hash-objects';
import { of } from 'rxjs';

describe('DependencyHandlerService', () => {
  let service: DependencyHandlerService;
  let eventBusServiceMock: jasmine.SpyObj<EventBusService>;
  let fieldRegistryServiceMock: jasmine.SpyObj<FieldRegistryService>;
  let conditionStrategyFactoryMock: jasmine.SpyObj<ConditionStrategyFactory>;
  let consoleSpy: jasmine.Spy;

  // Mock data
  const mockDependentField = 'testField';
  const mockTriggerField = 'triggerField';
  const mockHash = 'mockHash123';
  
  // Mock condition strategy
  const mockConditionStrategy = {
    isMet: jasmine.createSpy('isMet').and.returnValue(true)
  };
  
  // Mock dependent
  const mockDependent: IGenericStrategyInterface = {
    rowId: '123',
    getUniqueRowId: () => '123'
  } as any;

  // Mock dependency config
  const mockDependencyConfig: DependencyConfig = {
    dependsOnAction: 'VALUE_EXISTS',
    behavior: [Behavior.MODIFY_VALUE],
    inverseBehavior: [Behavior.RESET_VALUE],
    customAttributes: {
      dependsOnActionModifier: 'test',
    } as DependencyBaseCustomAttributes
  };

  beforeEach(() => {
    // Create spy objects
    eventBusServiceMock = jasmine.createSpyObj('EventBusService', ['subscribe', 'publish']);
    fieldRegistryServiceMock = jasmine.createSpyObj('FieldRegistryService', ['get']);
    conditionStrategyFactoryMock = jasmine.createSpyObj('ConditionStrategyFactory', ['getStrategy']);
    
    // Configure mocks
    conditionStrategyFactoryMock.getStrategy.and.returnValue(mockConditionStrategy);
    
    // Setup test module
    TestBed.configureTestingModule({
      providers: [
        DependencyHandlerService,
        { provide: EventBusService, useValue: eventBusServiceMock },
        { provide: FieldRegistryService, useValue: fieldRegistryServiceMock },
        { provide: ConditionStrategyFactory, useValue: conditionStrategyFactoryMock },
        { provide: HashObject, useValue: new HashObject() }
      ]
    });
    
    service = TestBed.inject(DependencyHandlerService);
    
    // Spy on console methods
    consoleSpy = spyOn(console, 'error').and.callThrough();
    
    // Reset mock counters
    mockConditionStrategy.isMet.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('registerDependencies', () => {
    it('should register dependencies for multiple configs', () => {
      const mockConfigs: DependencyConfig[] = [mockDependencyConfig];
      spyOn(service as any, 'registerDependency').and.callThrough();
      
      service.registerDependencies(mockDependent, mockConfigs);
      
      expect((service as any).registerDependency).toHaveBeenCalledWith(mockDependent, mockDependencyConfig);
    });
  });

  describe('registerDependency', () => {
    it('should register a new dependency if it does not exist', () => {
      spyOn(service as any, 'hashObject').and.returnValue(mockHash);
      
      (service as any).registerDependency(mockDependent, mockDependencyConfig);
      
      expect((service as any).dependencyMap.has(mockDependentField)).toBeTruthy();
      expect((service as any).hashDependencyMap.has(mockHash)).toBeTruthy();
    });
    
    it('should subscribe to events for the dependency', () => {
      spyOn(service as any, 'hashObject').and.returnValue(mockHash);
      spyOn(service, 'subscribeToEvents').and.callThrough();
      
      (service as any).registerDependency(mockDependent, mockDependencyConfig);
      
      expect(service.subscribeToEvents).toHaveBeenCalled();
    });
  });

  describe('subscribeToEvents', () => {
    it('should subscribe to events with the event bus service', () => {
      const eventName = `${mockDependentField}`;
      eventBusServiceMock.subscribe.and.returnValue(of({}));
      
      service.subscribeToEvents(mockDependent, mockTriggerField, mockDependentField, mockDependencyConfig);
      
      expect(eventBusServiceMock.subscribe).toHaveBeenCalled();
    });
  });

  describe('handleCondition', () => {
    it('should get strategy from condition factory', () => {
      const mockData = { value: 'test' };
      
      (service as any).handleCondition(mockDependent, mockDependent, mockDependencyConfig, mockData);
      
      expect(conditionStrategyFactoryMock.getStrategy).toHaveBeenCalledWith(mockDependencyConfig.dependsOnAction);
    });
    
    it('should log error if no condition strategy is found', () => {
      conditionStrategyFactoryMock.getStrategy.and.returnValue(undefined);
      const mockData = { value: 'test' };
      
      (service as any).handleCondition(mockDependent, mockDependent, mockDependencyConfig, mockData);
      
      expect(consoleSpy).toHaveBeenCalledWith(jasmine.stringMatching(/NO Condition strategy for/));
    });
    
    it('should check if condition is met and apply behaviors', () => {
      const mockData = { value: 'test' };
      spyOn(service as any, 'handleBehavior').and.callThrough();
      
      (service as any).handleCondition(mockDependent, mockDependent, mockDependencyConfig, mockData);
      
      expect(mockConditionStrategy.isMet).toHaveBeenCalled();
      expect((service as any).handleBehavior).toHaveBeenCalled();
    });
  });

  describe('handleBehavior', () => {
    it('should apply behavior for each behavior in config', () => {
      const mockField = jasmine.createSpyObj('Field', ['applyBehavior']);
      fieldRegistryServiceMock.get.and.returnValue(mockField);
      const mockData = { value: 'test' };
      
      (service as any).handleBehavior(Behavior.MODIFY_VALUE, mockDependent, mockDependencyConfig, mockData);
      
      expect(mockField.applyBehavior).toHaveBeenCalled();
    });
  });

  describe('publishEvent', () => {
    it('should publish event using event bus service', () => {
      const triggerName = 'testTrigger';
      const mockData = { value: 'test' };
      
      service.publishEvent(triggerName, mockData);
      
      expect(eventBusServiceMock.publish).toHaveBeenCalledWith(triggerName, mockData);
    });
  });
});