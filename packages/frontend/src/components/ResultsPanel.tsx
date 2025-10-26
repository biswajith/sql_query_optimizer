import { Flex, Heading, Text, View, Divider, StatusLight } from '@adobe/react-spectrum';
import type { OptimizationResult } from '@sql-optimizer/shared';
import { QueryComparison } from './QueryComparison';
import { ExplainPlanViewer } from './ExplainPlanViewer';
import { TableSchemaViewer } from './TableSchemaViewer';

interface ResultsPanelProps {
  result: OptimizationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <Flex direction="column" gap="size-400">
      {/* Cache Hit Indicator */}
      <Flex direction="row" alignItems="center" gap="size-100">
        <StatusLight variant={result.cacheHit ? 'positive' : 'neutral'}>
          {result.cacheHit ? 'Cache Hit' : 'Cache Miss'}
        </StatusLight>
        <Text UNSAFE_style={{ fontSize: '12px', color: '#6E6E6E' }}>
          {result.cacheHit ? 'Schema loaded from cache' : 'Schema fetched from database'}
        </Text>
      </Flex>

      <Divider size="M" />

      {/* Query Comparison */}
      <View>
        <Heading level={3}>Query Comparison</Heading>
        <QueryComparison
          originalQuery={result.originalQuery}
          optimizedQuery={result.optimizedQuery}
        />
      </View>

      <Divider size="M" />

      {/* Reasoning */}
      <View>
        <Heading level={3}>Optimization Analysis</Heading>
        <Text>{result.reasoning}</Text>
        
        {result.keyIssues && result.keyIssues.length > 0 && (
          <View marginTop="size-200">
            <Heading level={4}>Key Issues</Heading>
            <ul>
              {result.keyIssues.map((issue, index) => (
                <li key={index}><Text>{issue}</Text></li>
              ))}
            </ul>
          </View>
        )}
        
        {result.estimatedImprovement && (
          <View marginTop="size-200">
            <Text><strong>Estimated Improvement:</strong> {result.estimatedImprovement}</Text>
          </View>
        )}
      </View>

      {/* Index Recommendations */}
      {result.indexRecommendations && result.indexRecommendations.length > 0 && (
        <>
          <Divider size="M" />
          <View>
            <Heading level={3}>Index Recommendations</Heading>
            <Flex direction="column" gap="size-200">
              {result.indexRecommendations.map((rec, index) => (
                <View
                  key={index}
                  borderWidth="thin"
                  borderColor="informative"
                  borderRadius="medium"
                  padding="size-200"
                >
                  <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {rec.indexDefinition}
                  </Text>
                  <Text marginTop="size-100">{rec.reasoning}</Text>
                </View>
              ))}
            </Flex>
          </View>
        </>
      )}

      <Divider size="M" />

      {/* EXPLAIN Plan */}
      <View>
        <Heading level={3}>EXPLAIN Plan</Heading>
        <ExplainPlanViewer explainPlan={result.explainPlan} />
      </View>

      <Divider size="M" />

      {/* Table Schemas */}
      <View>
        <Heading level={3}>Table Schemas</Heading>
        <TableSchemaViewer tables={result.tables} />
      </View>
    </Flex>
  );
}

