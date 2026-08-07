USE AxiNetStat;
GO

-- ============================================================
-- 1. v_connection_stats aggregation (highest impact)
--
-- The view does: GROUP BY edge_key, MAX(id), MIN/MAX(observed_date)
-- Without INCLUDEs, every row requires a key lookup for id and
-- observed_date. With INCLUDEs the whole GROUP BY is index-only.
-- ============================================================
DROP INDEX IF EXISTS IX_connection_edge_edge_key ON dbo.connection_edge;
GO

-- endpoint_a/b_ciid added so edge_agg queries on connection_edge are index-only (no key lookups)
CREATE INDEX IX_connection_edge_edge_key
ON dbo.connection_edge (edge_key)
INCLUDE (id, observed_date, endpoint_a_ciid, endpoint_b_ciid);
GO

-- ============================================================
-- 2. managed_node cursor pagination
--
-- getNodeSummariesAsync / getCustomerNodeSummariesAsync filter
-- and sort by last_seen for cursor-based pagination.
-- ============================================================
DROP INDEX IF EXISTS IX_managed_node_last_seen ON dbo.managed_node;
GO

CREATE INDEX IX_managed_node_last_seen
ON dbo.managed_node (last_seen)
INCLUDE (fqdn, group_id, group_name, is_active);
GO

-- ============================================================
-- 3. Customer-scoped node queries
--
-- getCustomerNodeSummariesAsync and getCustomerEdgesAsync filter
-- WHERE na.group_id = @CustomerId OR nb.group_id = @CustomerId.
-- ============================================================
DROP INDEX IF EXISTS IX_managed_node_group_id ON dbo.managed_node;
GO

CREATE INDEX IX_managed_node_group_id
ON dbo.managed_node (group_id)
INCLUDE (ciid, fqdn, last_seen, is_active, group_name);
GO

-- ============================================================
-- 4. connection_edge ciid FK columns
--
-- getEdgesAsync joins managed_node on endpoint_a/b_ciid for fqdn
-- resolution and is_active / group_id filtering. Without these,
-- every edge row causes an unindexed lookup against managed_node.
-- Filtered: NULL ciid rows (unmanaged endpoints) are excluded.
-- ============================================================
DROP INDEX IF EXISTS IX_connection_edge_endpoint_a_ciid ON dbo.connection_edge;
GO

CREATE INDEX IX_connection_edge_endpoint_a_ciid
ON dbo.connection_edge (endpoint_a_ciid)
INCLUDE (endpoint_a_fqdn, endpoint_a_ipv4)
WHERE endpoint_a_ciid IS NOT NULL;
GO

DROP INDEX IF EXISTS IX_connection_edge_endpoint_b_ciid ON dbo.connection_edge;
GO

CREATE INDEX IX_connection_edge_endpoint_b_ciid
ON dbo.connection_edge (endpoint_b_ciid)
INCLUDE (endpoint_b_fqdn, endpoint_b_ipv4)
WHERE endpoint_b_ciid IS NOT NULL;
GO
