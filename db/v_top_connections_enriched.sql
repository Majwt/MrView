
CREATE OR ALTER VIEW dbo.v_top_connections_enriched
AS
SELECT
    tc.*,

    na.Customer   AS endpoint_a_customer,
    na.CustomerID AS endpoint_a_customer_id,

    nb.Customer   AS endpoint_b_customer,
    nb.CustomerID AS endpoint_b_customer_id

FROM dbo.top_connections tc
LEFT JOIN dbo.top_nodes na
    ON na.Fqdn = tc.endpoint_a
LEFT JOIN dbo.top_nodes nb
    ON nb.Fqdn = tc.endpoint_b;
GO
