import { Switch, Flex, Text } from '@adobe/react-spectrum';

interface OptimizationToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDisabled?: boolean;
}

export function OptimizationToggle({ checked, onChange, isDisabled }: OptimizationToggleProps) {
  return (
    <Flex direction="row" gap="size-200" alignItems="center">
      <Switch isSelected={checked} onChange={onChange} isDisabled={isDisabled}>
        Include Index Recommendations
      </Switch>
      <Text UNSAFE_style={{ fontSize: '12px', color: '#6E6E6E' }}>
        (Enable to get suggestions for creating new indexes)
      </Text>
    </Flex>
  );
}

