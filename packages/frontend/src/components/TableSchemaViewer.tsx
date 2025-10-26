import { Flex, Heading, Text, View } from '@adobe/react-spectrum';
import type { TableInfo } from '@sql-optimizer/shared';

interface TableSchemaViewerProps {
  tables: TableInfo[];
}

export function TableSchemaViewer({ tables }: TableSchemaViewerProps) {
  return (
    <Flex direction="column" gap="size-300">
      {tables.map((table) => (
        <View
          key={table.tableName}
          borderWidth="thin"
          borderColor="default"
          borderRadius="medium"
          padding="size-200"
        >
          <Heading level={4}>{table.tableName}</Heading>
          <View marginTop="size-100">
            <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {table.createStatement}
            </Text>
          </View>
        </View>
      ))}
    </Flex>
  );
}

