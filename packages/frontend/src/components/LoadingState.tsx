import { Flex, ProgressCircle, Text } from '@adobe/react-spectrum';

export function LoadingState() {
  return (
    <Flex direction="column" gap="size-200" alignItems="center" justifyContent="center" minHeight="size-3000">
      <ProgressCircle aria-label="Loading..." isIndeterminate />
      <Text>Analyzing your query and generating optimizations...</Text>
    </Flex>
  );
}

