import { Flex, Heading, Text, View } from '@adobe/react-spectrum';

interface QueryComparisonProps {
  originalQuery: string;
  optimizedQuery: string;
}

export function QueryComparison({ originalQuery, optimizedQuery }: QueryComparisonProps) {
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
        borderColor="positive"
        borderRadius="medium"
        padding="size-200"
        backgroundColor="positive"
      >
        <Heading level={4}>Optimized Query</Heading>
        <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {optimizedQuery}
        </Text>
      </View>
    </Flex>
  );
}

