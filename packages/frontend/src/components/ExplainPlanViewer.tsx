import { TableView, TableHeader, Column, TableBody, Row, Cell } from '@adobe/react-spectrum';
import type { ExplainPlanRow } from '@sql-optimizer/shared';

interface ExplainPlanViewerProps {
  explainPlan: ExplainPlanRow[];
}

export function ExplainPlanViewer({ explainPlan }: ExplainPlanViewerProps) {
  return (
    <TableView aria-label="EXPLAIN Plan" width="100%" height="auto">
      <TableHeader>
        <Column key="id">ID</Column>
        <Column key="select_type">Select Type</Column>
        <Column key="table">Table</Column>
        <Column key="type">Type</Column>
        <Column key="possible_keys">Possible Keys</Column>
        <Column key="key">Key</Column>
        <Column key="rows">Rows</Column>
        <Column key="filtered">Filtered</Column>
        <Column key="Extra">Extra</Column>
      </TableHeader>
      <TableBody>
        {explainPlan.map((row, index) => (
          <Row key={index}>
            <Cell>{row.id}</Cell>
            <Cell>{row.select_type}</Cell>
            <Cell>{row.table}</Cell>
            <Cell>{row.type}</Cell>
            <Cell>{row.possible_keys || 'NULL'}</Cell>
            <Cell>{row.key || 'NULL'}</Cell>
            <Cell>{row.rows}</Cell>
            <Cell>{row.filtered.toFixed(2)}%</Cell>
            <Cell>{row.Extra}</Cell>
          </Row>
        ))}
      </TableBody>
    </TableView>
  );
}

