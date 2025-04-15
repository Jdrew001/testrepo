import { TestBed } from '@angular/core/testing';
import { DependencyAdapterFactoryService } from './dependency-adapter-factory.service';
import { JsonAdapter } from '../interfaces/dep-json-adapter.model';
import { AbstractJsonMapper } from '../interfaces/abstract-jsonmapper';

describe('DependencyAdapterFactoryService', () => {
  let service: DependencyAdapterFactoryService;
  let consoleSpy: jasmine.Spy;

  // Mock adapter implementation
  class MockJsonAdapter implements JsonAdapter {
    key = 'mockAdapter';
    adapter = jasmine.createSpyObj('AbstractJsonMapper', ['map']);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DependencyAdapterFactoryService]
    });
    
    service = TestBed.inject(DependencyAdapterFactoryService);
    consoleSpy = spyOn(console, 'warn').and.callThrough();
    consoleSpy = spyOn(console, 'log').and.callThrough();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should register a JsonAdapter successfully', () => {
    const mockAdapter = new MockJsonAdapter();
    service.registerJsonAdapter(mockAdapter);
    
    const retrievedAdapter = service.getAdapterByKey('mockAdapter');
    expect(retrievedAdapter).toBe(mockAdapter.adapter);
  });

  it('should warn when registering an adapter with a duplicate key', () => {
    const mockAdapter1 = new MockJsonAdapter();
    const mockAdapter2 = new MockJsonAdapter();
    
    service.registerJsonAdapter(mockAdapter1);
    service.registerJsonAdapter(mockAdapter2);
    
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      jasmine.stringMatching(/Duplicate Adapter key: mockAdapter/)
    );
  });

  it('should not register an adapter with a duplicate key', () => {
    const mockAdapter1 = new MockJsonAdapter();
    const mockAdapter2 = new MockJsonAdapter();
    mockAdapter2.adapter = jasmine.createSpyObj('AbstractJsonMapper', ['differentMap']);
    
    service.registerJsonAdapter(mockAdapter1);
    service.registerJsonAdapter(mockAdapter2);
    
    // Should keep the first adapter
    const retrievedAdapter = service.getAdapterByKey('mockAdapter');
    expect(retrievedAdapter).toBe(mockAdapter1.adapter);
    expect(retrievedAdapter).not.toBe(mockAdapter2.adapter);
  });

  it('should register multiple adapters with registerJsonAdapters', () => {
    const mockAdapter1 = new MockJsonAdapter();
    mockAdapter1.key = 'adapter1';
    
    const mockAdapter2 = new MockJsonAdapter();
    mockAdapter2.key = 'adapter2';
    
    const adapters = [mockAdapter1, mockAdapter2];
    
    service.registerJsonAdapters(adapters);
    
    expect(service.getAdapterByKey('adapter1')).toBe(mockAdapter1.adapter);
    expect(service.getAdapterByKey('adapter2')).toBe(mockAdapter2.adapter);
  });

  it('should return undefined for a non-existent adapter key', () => {
    const adapter = service.getAdapterByKey('nonExistentKey');
    expect(adapter).toBeUndefined();
  });

  it('should return all registered adapters with getAdapters', () => {
    const mockAdapter1 = new MockJsonAdapter();
    mockAdapter1.key = 'adapter1';
    
    const mockAdapter2 = new MockJsonAdapter();
    mockAdapter2.key = 'adapter2';
    
    service.registerJsonAdapter(mockAdapter1);
    service.registerJsonAdapter(mockAdapter2);
    
    const adapters = service.getAdapters();
    
    expect(adapters.size).toBe(2);
    expect(adapters.get('adapter1')).toBe(mockAdapter1.adapter);
    expect(adapters.get('adapter2')).toBe(mockAdapter2.adapter);
  });

  it('should log registered adapters with printAdapters', () => {
    const mockAdapter1 = new MockJsonAdapter();
    mockAdapter1.key = 'adapter1';
    
    service.registerJsonAdapter(mockAdapter1);
    service.printAdapters();
    
    expect(consoleSpy.log).toHaveBeenCalledWith(
      'Registered Adapters:',
      jasmine.any(Object)
    );
  });
});