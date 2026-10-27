import React, { createContext, useContext } from 'react';
import { useFlowTrigger } from './useFlowTrigger';
import { API_BASE } from '../config';
import { getAuthToken } from '../dataProvider';

type CrudEvent = 'create' | 'update' | 'delete';

interface FlowContextValue {
  triggerFlows: (event: CrudEvent, resourceName: string, data: Record<string, unknown>) => Promise<void>;
  triggerFieldChange: (resourceName: string, fieldName: string, newValue: unknown, record: Record<string, unknown>) => Promise<void>;
  triggerManualFlow: (flowId: string, data?: Record<string, unknown>) => Promise<void>;
}

const FlowContext = createContext<FlowContextValue>({
  triggerFlows: async () => {},
  triggerFieldChange: async () => {},
  triggerManualFlow: async () => {},
});

export const useFlows = () => useContext(FlowContext);

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { triggerFlows, triggerFieldChange, triggerManualFlow } = useFlowTrigger(API_BASE, getAuthToken());

  return (
    <FlowContext.Provider value={{ triggerFlows, triggerFieldChange, triggerManualFlow }}>
      {children}
    </FlowContext.Provider>
  );
};
