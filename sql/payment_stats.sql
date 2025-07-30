-- Create payment statistics function
CREATE OR REPLACE FUNCTION get_payment_stats(start_date timestamp, end_date timestamp)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    WITH stats AS (
        SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_orders,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0) as total_amount,
            AVG(CASE WHEN status = 'COMPLETED' THEN amount END) as avg_order_value
        FROM orders
        WHERE created_at BETWEEN start_date AND end_date
    ),
    hourly_stats AS (
        SELECT 
            date_trunc('hour', created_at) as hour,
            COUNT(*) as orders,
            SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as revenue
        FROM orders
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY date_trunc('hour', created_at)
        ORDER BY hour DESC
        LIMIT 24
    ),
    error_stats AS (
        SELECT 
            status as error_type,
            COUNT(*) as count
        FROM payment_logs
        WHERE event_type = 'ERROR'
        AND created_at BETWEEN start_date AND end_date
        GROUP BY status
        ORDER BY count DESC
        LIMIT 5
    )
    SELECT json_build_object(
        'summary', (
            SELECT row_to_json(stats.*)
            FROM stats
        ),
        'hourly_trend', (
            SELECT json_agg(row_to_json(hourly_stats.*))
            FROM hourly_stats
        ),
        'top_errors', (
            SELECT json_agg(row_to_json(error_stats.*))
            FROM error_stats
        )
    ) INTO result;

    RETURN result;
END;
$$;
