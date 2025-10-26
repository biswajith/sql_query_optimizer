import axios from 'axios';
import type { OptimizationRequest, OptimizationResult, ApiResponse, HealthCheckResponse } from '@sql-optimizer/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

export async function optimizeQuery(
  request: OptimizationRequest
): Promise<OptimizationResult> {
  const response = await apiClient.post<ApiResponse<OptimizationResult>>(
    '/optimize',
    request
  );
  
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Optimization failed');
  }
  
  return response.data.data;
}

export async function checkHealth(): Promise<HealthCheckResponse> {
  const response = await apiClient.get<ApiResponse<HealthCheckResponse>>('/health');
  
  if (!response.data.data) {
    throw new Error('Health check failed');
  }
  
  return response.data.data;
}

