import { TextArea, Button, Flex } from '@adobe/react-spectrum';

interface QueryInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
}

export function QueryInput({ value, onChange, onSubmit, onClear, loading }: QueryInputProps) {
  return (
    <Flex direction="column" gap="size-200">
      <TextArea
        label="SQL Query"
        placeholder="Enter your SQL query here..."
        value={value}
        onChange={onChange}
        width="100%"
        height="size-3000"
        isDisabled={loading}
      />
      <Flex gap="size-200" justifyContent="end">
        <Button variant="secondary" onPress={onClear} isDisabled={loading || !value}>
          Clear
        </Button>
        <Button variant="accent" onPress={onSubmit} isDisabled={loading || !value}>
          {loading ? 'Analyzing...' : 'Optimize Query'}
        </Button>
      </Flex>
    </Flex>
  );
}

