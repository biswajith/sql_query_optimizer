import { Flex, Heading, Text, View, Divider, StatusLight } from '@adobe/react-spectrum';
import type { OptimizationResult, VerificationStatus } from '@sql-optimizer/shared';
import { QueryComparison } from './QueryComparison';
import { ExplainPlanViewer } from './ExplainPlanViewer';
import { TableSchemaViewer } from './TableSchemaViewer';

const VERIFICATION: Record<
  VerificationStatus,
  { variant: 'positive' | 'notice' | 'negative' | 'neutral'; label: string }
> = {
  improved: { variant: 'positive', label: 'Verified: lower estimated cost' },
  not_improved: { variant: 'notice', label: 'Valid, but not cheaper' },
  no_change: { variant: 'neutral', label: 'No better query found' },
  unknown: { variant: 'neutral', label: 'Valid, cost not comparable' },
  invalid: { variant: 'negative', label: 'Suggested query failed verification' },
};

interface ResultsPanelProps {
  result: OptimizationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const verification = VERIFICATION[result.verification];

  return (
    <Flex direction="column" gap="size-400">
      {/* Verification outcome, from the server's own EXPLAIN of the final query */}
      <Flex direction="column" gap="size-50">
        <StatusLight variant={verification.variant}>{verification.label}</StatusLight>
        {result.estimatedImprovement && <Text>{result.estimatedImprovement}</Text>}
        {result.verificationNote && <Text>{result.verificationNote}</Text>}
        <Text UNSAFE_style={{ fontSize: '12px', color: '#6E6E6E' }}>
          Costs are MySQL optimizer estimates. Equivalence of results is not checked
          automatically; review the rewrite before using it.
        </Text>
      </Flex>

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
          improved={result.verification === 'improved'}
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

        {result.attempts.length > 0 && (
          <View marginTop="size-200">
            <Heading level={4}>Candidates the agent tested</Heading>
            <ol>
              {result.attempts.map((attempt, index) => (
                <li key={index}>
                  <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                    {attempt.query}
                  </Text>
                  <br />
                  <Text UNSAFE_style={{ fontSize: '12px', color: '#6E6E6E' }}>
                    {attempt.error
                      ? `Rejected: ${attempt.error}`
                      : `Estimated cost: ${attempt.queryCost ?? 'unknown'}`}
                  </Text>
                </li>
              ))}
            </ol>
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
        <Heading level={3}>
          EXPLAIN Plan (original{result.originalCost !== null ? `, cost ${result.originalCost}` : ''})
        </Heading>
        <ExplainPlanViewer explainPlan={result.explainPlan} />
      </View>

      {result.optimizedExplainPlan && (
        <View>
          <Heading level={3}>
            EXPLAIN Plan (optimized{result.optimizedCost !== null ? `, cost ${result.optimizedCost}` : ''})
          </Heading>
          <ExplainPlanViewer explainPlan={result.optimizedExplainPlan} />
        </View>
      )}

      <Divider size="M" />

      {/* Table Schemas */}
      <View>
        <Heading level={3}>Table Schemas</Heading>
        <TableSchemaViewer tables={result.tables} />
      </View>
    </Flex>
  );
}

