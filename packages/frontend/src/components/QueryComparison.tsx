import { Flex, Heading, Text, View } from '@adobe/react-spectrum';

interface QueryComparisonProps {
  originalQuery: string;
  optimizedQuery: string;
  /** Only highlight the suggestion as a win when the server verified it. */
  improved: boolean;
}

export function QueryComparison({ originalQuery, optimizedQuery, improved }: QueryComparisonProps) {
  return (
    <Flex direction="row" gap="size-300" wrap>
      <View
        flex={1}
        minWidth="size-5000"
        borderWidth="thin"
        borderColor="default"
        borderRadius="medium"
        padding="size-200"
      >
        <Heading level={4}>Original Query</Heading>
        <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {originalQuery}
        </Text>
      </View>
      <View
        flex={1}
        minWidth="size-5000"
        borderWidth="thin"
        borderColor={improved ? 'positive' : 'default'}
        borderRadius="medium"
        padding="size-200"
        backgroundColor={improved ? 'positive' : undefined}
      >
        <Heading level={4}>{improved ? 'Optimized Query' : 'Suggested Query'}</Heading>
        <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {optimizedQuery}
        </Text>
      </View>
    </Flex>
  );
}

