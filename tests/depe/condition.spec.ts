import { TestBed } from '@angular/core/testing';
import { ConditionStrategyFactory } from './condition-strategy.factory';
import { Condition } from '../../model/configs/dependency.config';
import { IConditionStrategy } from '../interfaces/IConditionStrategy';
import { ClickedCondition } from '../strategy/conditions/clicked.condition';
import { ExistsCondition } from '../strategy/conditions/exists.condition';
import { OnChangeCondition } from '../strategy/conditions/on-change.condition';
import { SelectedCondition } from '../strategy/conditions/selected.condition';
import { OnLoadCondition } from '../strategy/conditions/on-load.condition';
import { AnyExistsCondition } from '../strategy/conditions/any-exists.condition';

describe('ConditionStrategyFactory', () => {
  let factory: ConditionStrategyFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConditionStrategyFactory]
    });
    
    factory = TestBed.inject(ConditionStrategyFactory);
  });

  it('should be created', () => {
    expect(factory).toBeTruthy();
  });

  it('should return ClickedCondition when CLICKED is requested', () => {
    const strategy = factory.getStrategy(Condition.CLICKED);
    expect(strategy).toBeInstanceOf(ClickedCondition);
  });

  it('should return ExistsCondition when VALUE_EXISTS is requested', () => {
    const strategy = factory.getStrategy(Condition.VALUE_EXISTS);
    expect(strategy).toBeInstanceOf(ExistsCondition);
  });

  it('should return OnChangeCondition when ON_CHANGE is requested', () => {
    const strategy = factory.getStrategy(Condition.ON_CHANGE);
    expect(strategy).toBeInstanceOf(OnChangeCondition);
  });

  it('should return SelectedCondition when VALUE_SELECTED is requested', () => {
    const strategy = factory.getStrategy(Condition.VALUE_SELECTED);
    expect(strategy).toBeInstanceOf(SelectedCondition);
  });

  it('should return OnLoadCondition when LOADED is requested', () => {
    const strategy = factory.getStrategy(Condition.LOADED);
    expect(strategy).toBeInstanceOf(OnLoadCondition);
  });

  it('should return AnyExistsCondition when ANY_VALUE_EXISTS is requested', () => {
    const strategy = factory.getStrategy(Condition.ANY_VALUE_EXISTS);
    expect(strategy).toBeInstanceOf(AnyExistsCondition);
  });

  it('should return undefined when an unknown condition is requested', () => {
    const strategy = factory.getStrategy('UNKNOWN_CONDITION' as any);
    expect(strategy).toBeUndefined();
  });

  it('should successfully add new condition strategies', () => {
    // Create a mock strategy
    const mockStrategy: IConditionStrategy = {} as IConditionStrategy;
    const newStrategies = {
      'CUSTOM_CONDITION': mockStrategy
    };
    
    factory.addConditionStrategies(newStrategies);
    
    // Now the factory should return our mock strategy
    const strategy = factory.getStrategy('CUSTOM_CONDITION' as any);
    expect(strategy).toBe(mockStrategy);
  });

  it('should merge new strategies with existing ones when adding condition strategies', () => {
    // Save reference to original CLICKED strategy
    const originalStrategy = factory.getStrategy(Condition.CLICKED);
    
    // Create a mock strategy
    const mockStrategy: IConditionStrategy = {} as IConditionStrategy;
    const newStrategies = {
      'CUSTOM_CONDITION': mockStrategy
    };
    
    factory.addConditionStrategies(newStrategies);
    
    // Original strategy should still be accessible
    const existingStrategy = factory.getStrategy(Condition.CLICKED);
    expect(existingStrategy).toBe(originalStrategy);
    
    // And new strategy should also be accessible
    const customStrategy = factory.getStrategy('CUSTOM_CONDITION' as any);
    expect(customStrategy).toBe(mockStrategy);
  });
});