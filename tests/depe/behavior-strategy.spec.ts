import { TestBed } from '@angular/core/testing';
import { BehaviorStrategyFactory } from './behavior-strategy.factory';
import { Behavior } from '../../model/configs/dependency.config';
import { IFieldBehaviorStrategy } from '../interfaces/IFieldBehaviorStrategy';
import { ModifyValueBehavior } from '../strategy/behaviors/modify-value.behavior';
import { TransformValueBehavior } from '../strategy/behaviors/transform-value.behavior';
import { ResetValueBehavior } from '../strategy/behaviors/reset-value.behavior';
import { ModifyConfigBehavior } from '../strategy/behaviors/modify-config.behavior';
import { ModifyValidatorBehavior } from '../strategy/behaviors/modify-validator.behavior';
import { DialogButtonConfirmBehavior } from '../strategy/behaviors/dialog-button-confirm.behavior';
import { DialogOpenBehavior } from '../strategy/behaviors/dialog-open.behavior';

describe('BehaviorStrategyFactory', () => {
  let factory: BehaviorStrategyFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BehaviorStrategyFactory]
    });
    
    factory = TestBed.inject(BehaviorStrategyFactory);
  });

  it('should be created', () => {
    expect(factory).toBeTruthy();
  });

  it('should return ModifyValueBehavior when MODIFY_VALUE is requested', () => {
    const strategy = factory.getStrategy(Behavior.MODIFY_VALUE);
    expect(strategy).toBeInstanceOf(ModifyValueBehavior);
  });

  it('should return TransformValueBehavior when TRANSFORM_VALUE is requested', () => {
    const strategy = factory.getStrategy(Behavior.TRANSFORM_VALUE);
    expect(strategy).toBeInstanceOf(TransformValueBehavior);
  });

  it('should return ResetValueBehavior when RESET_VALUE is requested', () => {
    const strategy = factory.getStrategy(Behavior.RESET_VALUE);
    expect(strategy).toBeInstanceOf(ResetValueBehavior);
  });

  it('should return ModifyConfigBehavior when SHOW is requested', () => {
    const strategy = factory.getStrategy(Behavior.SHOW);
    expect(strategy).toBeInstanceOf(ModifyConfigBehavior);
  });

  it('should return ModifyConfigBehavior when HIDE is requested', () => {
    const strategy = factory.getStrategy(Behavior.HIDE);
    expect(strategy).toBeInstanceOf(ModifyConfigBehavior);
  });

  it('should return ModifyConfigBehavior when ENABLE is requested', () => {
    const strategy = factory.getStrategy(Behavior.ENABLE);
    expect(strategy).toBeInstanceOf(ModifyConfigBehavior);
  });

  it('should return ModifyConfigBehavior when DISABLE is requested', () => {
    const strategy = factory.getStrategy(Behavior.DISABLE);
    expect(strategy).toBeInstanceOf(ModifyConfigBehavior);
  });

  it('should return ModifyValidatorBehavior when ADD_VALIDATORS is requested', () => {
    const strategy = factory.getStrategy(Behavior.ADD_VALIDATORS);
    expect(strategy).toBeInstanceOf(ModifyValidatorBehavior);
  });

  it('should return ModifyValidatorBehavior when REMOVE_VALIDATORS is requested', () => {
    const strategy = factory.getStrategy(Behavior.REMOVE_VALIDATORS);
    expect(strategy).toBeInstanceOf(ModifyValidatorBehavior);
  });

  it('should return DialogButtonConfirmBehavior when DIALOG_CONFIRM is requested', () => {
    const strategy = factory.getStrategy(Behavior.DIALOG_CONFIRM);
    expect(strategy).toBeInstanceOf(DialogButtonConfirmBehavior);
  });

  it('should return DialogOpenBehavior when DIALOG_OPEN is requested', () => {
    const strategy = factory.getStrategy(Behavior.DIALOG_OPEN);
    expect(strategy).toBeInstanceOf(DialogOpenBehavior);
  });

  it('should return undefined when an unknown behavior is requested', () => {
    const strategy = factory.getStrategy('UNKNOWN_BEHAVIOR' as any);
    expect(strategy).toBeUndefined();
  });

  it('should successfully add new behavior strategies', () => {
    // Create a mock strategy
    const mockStrategy: IFieldBehaviorStrategy = {} as IFieldBehaviorStrategy;
    const newStrategies = {
      'CUSTOM_BEHAVIOR': mockStrategy
    };
    
    factory.addBehaviorStrategies(newStrategies);
    
    // Now the factory should return our mock strategy
    const strategy = factory.getStrategy('CUSTOM_BEHAVIOR' as any);
    expect(strategy).toBe(mockStrategy);
  });

  it('should merge new strategies with existing ones when adding behavior strategies', () => {
    // Save reference to original MODIFY_VALUE strategy
    const originalStrategy = factory.getStrategy(Behavior.MODIFY_VALUE);
    
    // Create a mock strategy
    const mockStrategy: IFieldBehaviorStrategy = {} as IFieldBehaviorStrategy;
    const newStrategies = {
      'CUSTOM_BEHAVIOR': mockStrategy
    };
    
    factory.addBehaviorStrategies(newStrategies);
    
    // Original strategy should still be accessible
    const existingStrategy = factory.getStrategy(Behavior.MODIFY_VALUE);
    expect(existingStrategy).toBe(originalStrategy);
    
    // And new strategy should also be accessible
    const customStrategy = factory.getStrategy('CUSTOM_BEHAVIOR' as any);
    expect(customStrategy).toBe(mockStrategy);
  });
});