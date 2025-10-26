import { useState } from 'react';
import {
  Provider,
  defaultTheme,
  View,
  Flex,
  Heading,
  Divider,
  AlertDialog,
  DialogTrigger,
  ActionButton,
  Content,
} from '@adobe/react-spectrum';
import { QueryInput } from './components/QueryInput';
import { OptimizationToggle } from './components/OptimizationToggle';
import { ResultsPanel } from './components/ResultsPanel';
import { LoadingState } from './components/LoadingState';
import { useQueryOptimizer } from './hooks/useQueryOptimizer';

function App() {
  const [query, setQuery] = useState('');
  const [includeIndexRecommendations, setIncludeIndexRecommendations] = useState(false);
  const { result, loading, error, optimize, reset } = useQueryOptimizer();

  const handleSubmit = () => {
    if (query.trim()) {
      optimize(query, includeIndexRecommendations);
    }
  };

  const handleClear = () => {
    setQuery('');
    reset();
  };

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View
        padding="size-400"
        maxWidth="size-6000"
        marginX="auto"
        minHeight="100vh"
        backgroundColor="gray-50"
      >
        <Flex direction="column" gap="size-400">
          {/* Header */}
          <View>
            <Heading level={1}>SQL Query Optimizer</Heading>
            <Heading level={4} marginTop="size-100" UNSAFE_style={{ fontWeight: 'normal', color: '#6E6E6E' }}>
              Analyze and optimize your SQL queries using AI-powered suggestions
            </Heading>
          </View>

          <Divider size="M" />

          {/* Input Section */}
          <View>
            <QueryInput
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              onClear={handleClear}
              loading={loading}
            />
          </View>

          {/* Options */}
          <View>
            <OptimizationToggle
              checked={includeIndexRecommendations}
              onChange={setIncludeIndexRecommendations}
              isDisabled={loading}
            />
          </View>

          <Divider size="M" />

          {/* Results Section */}
          {loading && <LoadingState />}

          {error && (
            <View
              borderWidth="thin"
              borderColor="negative"
              borderRadius="medium"
              padding="size-200"
              backgroundColor="red-100"
            >
              <Heading level={4} UNSAFE_style={{ color: '#C5221F' }}>Error</Heading>
              <Content>{error}</Content>
            </View>
          )}

          {result && !loading && <ResultsPanel result={result} />}

          {!result && !loading && !error && (
            <View
              borderWidth="thin"
              borderColor="default"
              borderRadius="medium"
              padding="size-400"
              UNSAFE_style={{ textAlign: 'center' }}
            >
              <Heading level={3}>Welcome!</Heading>
              <Content marginTop="size-200">
                Enter your SQL query above and click "Optimize Query" to get started.
                <br />
                <br />
                The optimizer will:
                <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                  <li>Analyze your query structure</li>
                  <li>Generate an EXPLAIN plan</li>
                  <li>Suggest optimizations</li>
                  <li>Show table schemas and indexes</li>
                  <li>Optionally recommend new indexes</li>
                </ul>
              </Content>
            </View>
          )}
        </Flex>
      </View>
    </Provider>
  );
}

export default App;

