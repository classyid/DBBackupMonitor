/**
 * Google Apps Script untuk menghubungkan ke database MySQL dan menyediakan layanan API
 * untuk web app backup database monitoring.
 */

// Konfigurasi Database
const DB_CONFIG = {
  host: 'host-server',
  user: 'user-db',
  password: 'password-db',
  database: 'nama-db'
};

/**
 * Fungsi untuk membuat koneksi ke database
 * @returns {object} - JDBC connection
 */
function getConnection() {
  try {
    const connectionString = `jdbc:mysql://${DB_CONFIG.host}/${DB_CONFIG.database}?useSSL=false`;
    Logger.log(`Connecting to: ${connectionString}`);
    
    const conn = Jdbc.getConnection(
      connectionString,
      DB_CONFIG.user,
      DB_CONFIG.password
    );
    
    conn.setAutoCommit(false);
    Logger.log("Connection successful");
    return conn;
  } catch (e) {
    Logger.log(`Error connecting to MySQL: ${e.toString()}`);
    throw new Error(`Database connection failed: ${e.message}`);
  }
}

/**
 * Mengeksekusi query dan mengembalikan hasil dalam format JSON
 * @param {string} query - SQL query untuk dieksekusi
 * @param {Array} params - Parameter untuk query
 * @returns {Array} - Hasil query dalam bentuk array object
 */
function executeQuery(query, params = []) {
  let conn;
  try {
    conn = getConnection();
    const stmt = conn.prepareStatement(query);
    
    // Bind parameters jika ada
    if (params && params.length > 0) {
      for (let i = 0; i < params.length; i++) {
        stmt.setString(i + 1, params[i]);
      }
    }
    
    const results = stmt.executeQuery();
    const metaData = results.getMetaData();
    const numCols = metaData.getColumnCount();
    const resultArray = [];

    while (results.next()) {
      const row = {};
      for (let i = 1; i <= numCols; i++) {
        const columnName = metaData.getColumnName(i);
        row[columnName] = results.getString(i);
      }
      resultArray.push(row);
    }
    
    results.close();
    stmt.close();
    conn.commit();
    
    return resultArray;
  } catch (e) {
    if (conn) {
      conn.rollback();
    }
    Logger.log(`Error executing query: ${e.toString()}`);
    throw e;
  } finally {
    if (conn) {
      conn.close();
    }
  }
}

/**
 * Mengambil data untuk dashboard utama
 * @returns {object} - Data dashboard
 */
function getDashboardData() {
  try {
    // Summary data
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(total_databases) as total_databases,
        SUM(successful_backups) as total_successful,
        SUM(failed_backups) as total_failed
      FROM backup_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const summaryData = executeQuery(summaryQuery)[0];
    
    // Recent sessions
    const recentSessionsQuery = `
      SELECT 
        session_id,
        start_time,
        end_time,
        status,
        total_users,
        total_databases,
        successful_backups,
        failed_backups
      FROM backup_sessions
      ORDER BY start_time DESC
      LIMIT 10
    `;
    const recentSessions = executeQuery(recentSessionsQuery);
    
    // Success rate over time
    const successRateQuery = `
      SELECT 
        DATE(start_time) as date,
        SUM(successful_backups) as successful,
        SUM(failed_backups) as failed
      FROM backup_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(start_time)
      ORDER BY DATE(start_time)
    `;
    const successRateData = executeQuery(successRateQuery);
    
    // User statistics
    const userStatsQuery = `
      SELECT 
        u.mysql_user,
        COUNT(DISTINCT u.user_backup_id) as total_backups,
        SUM(u.successful_backups) as successful,
        SUM(u.failed_backups) as failed,
        MAX(u.start_time) as last_backup
      FROM user_backups u
      JOIN backup_sessions s ON u.session_id = s.session_id
      WHERE s.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY u.mysql_user
      ORDER BY SUM(u.successful_backups) DESC
      LIMIT 10
    `;
    const userStats = executeQuery(userStatsQuery);
    
    // Error statistics
    const errorStatsQuery = `
      SELECT 
        error_message,
        COUNT(*) as count
      FROM database_backups
      WHERE status = 'failed'
      AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY error_message
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `;
    const errorStats = executeQuery(errorStatsQuery);
    
    return {
      summary: summaryData,
      recentSessions: recentSessions,
      successRateData: successRateData,
      userStats: userStats,
      errorStats: errorStats
    };
  } catch (e) {
    Logger.log(`Error getting dashboard data: ${e.toString()}`);
    return { error: e.toString() };
  }
}

/**
 * Mengambil detail session berdasarkan ID
 * @param {number} sessionId - ID session
 * @returns {object} - Detail session
 */
function getSessionDetails(sessionId) {
  try {
    // Session info
    const sessionQuery = `
      SELECT * FROM backup_sessions WHERE session_id = ?
    `;
    const sessionInfo = executeQuery(sessionQuery, [sessionId])[0];
    
    // User backups for this session
    const userBackupsQuery = `
      SELECT * FROM user_backups WHERE session_id = ? ORDER BY start_time
    `;
    const userBackups = executeQuery(userBackupsQuery, [sessionId]);
    
    // Database backups statistics for this session
    const dbBackupsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM database_backups
      WHERE session_id = ?
      GROUP BY status
    `;
    const dbBackupsStats = executeQuery(dbBackupsQuery, [sessionId]);
    
    // Telegram notifications for this session
    const notificationsQuery = `
      SELECT * FROM telegram_notifications 
      WHERE session_id = ? 
      ORDER BY send_time DESC
      LIMIT 20
    `;
    const notifications = executeQuery(notificationsQuery, [sessionId]);
    
    // Logs for this session
    const logsQuery = `
      SELECT * FROM backup_logs 
      WHERE session_id = ? 
      ORDER BY log_time DESC
      LIMIT 100
    `;
    const logs = executeQuery(logsQuery, [sessionId]);
    
    return {
      sessionInfo: sessionInfo,
      userBackups: userBackups,
      dbBackupsStats: dbBackupsStats,
      notifications: notifications,
      logs: logs
    };
  } catch (e) {
    Logger.log(`Error getting session details: ${e.toString()}`);
    return { error: e.toString() };
  }
}

/**
 * Mengambil detail backup user berdasarkan ID
 * @param {number} userBackupId - ID user backup
 * @returns {object} - Detail user backup
 */
function getUserBackupDetails(userBackupId) {
  try {
    // User backup info
    const userBackupQuery = `
      SELECT 
        u.*,
        s.start_time as session_start_time,
        s.status as session_status
      FROM user_backups u
      JOIN backup_sessions s ON u.session_id = s.session_id
      WHERE u.user_backup_id = ?
    `;
    const userBackupInfo = executeQuery(userBackupQuery, [userBackupId])[0];
    
    // Database backups for this user backup
    const dbBackupsQuery = `
      SELECT * FROM database_backups 
      WHERE user_backup_id = ? 
      ORDER BY start_time
    `;
    const dbBackups = executeQuery(dbBackupsQuery, [userBackupId]);
    
    // Logs for this user backup
    const logsQuery = `
      SELECT * FROM backup_logs 
      WHERE user_backup_id = ? 
      ORDER BY log_time DESC
    `;
    const logs = executeQuery(logsQuery, [userBackupId]);
    
    return {
      userBackupInfo: userBackupInfo,
      dbBackups: dbBackups,
      logs: logs
    };
  } catch (e) {
    Logger.log(`Error getting user backup details: ${e.toString()}`);
    return { error: e.toString() };
  }
}

/**
 * Doingkan pencarian session berdasarkan tanggal atau status
 * @param {object} params - Parameter pencarian
 * @returns {Array} - Hasil pencarian
 */
function searchSessions(params) {
  try {
    let query = `
      SELECT 
        session_id,
        start_time,
        end_time,
        status,
        total_users,
        total_databases,
        successful_backups,
        failed_backups
      FROM backup_sessions
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    if (params.startDate) {
      query += ` AND start_time >= ?`;
      queryParams.push(params.startDate);
    }
    
    if (params.endDate) {
      query += ` AND start_time <= ?`;
      queryParams.push(params.endDate);
    }
    
    if (params.status) {
      query += ` AND status = ?`;
      queryParams.push(params.status);
    }
    
    query += ` ORDER BY start_time DESC LIMIT 100`;
    
    return executeQuery(query, queryParams);
  } catch (e) {
    Logger.log(`Error searching sessions: ${e.toString()}`);
    return { error: e.toString() };
  }
}

/**
 * Mendapatkan data statistik untuk analitik
 * @returns {object} - Data statistik
 */
function getAnalyticsData() {
  try {
    // Statistik bulanan
    const monthlyStatsQuery = `
      SELECT 
        DATE_FORMAT(start_time, '%Y-%m') as month,
        COUNT(*) as total_sessions,
        SUM(total_databases) as total_databases,
        SUM(successful_backups) as successful,
        SUM(failed_backups) as failed,
        ROUND(SUM(successful_backups) / SUM(total_databases) * 100, 2) as success_rate
      FROM backup_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(start_time, '%Y-%m')
      ORDER BY DATE_FORMAT(start_time, '%Y-%m')
    `;
    const monthlyStats = executeQuery(monthlyStatsQuery);
    
    // Top 10 user dengan backup terbanyak
    const topUsersQuery = `
      SELECT 
        u.mysql_user,
        COUNT(DISTINCT u.user_backup_id) as backup_count,
        SUM(u.successful_backups) as successful,
        SUM(u.failed_backups) as failed,
        ROUND(SUM(u.successful_backups) / (SUM(u.successful_backups) + SUM(u.failed_backups)) * 100, 2) as success_rate
      FROM user_backups u
      GROUP BY u.mysql_user
      ORDER BY backup_count DESC
      LIMIT 10
    `;
    const topUsers = executeQuery(topUsersQuery);
    
    // Distribusi error
    const errorDistributionQuery = `
      SELECT 
        SUBSTRING_INDEX(error_message, ':', 1) as error_type,
        COUNT(*) as count
      FROM database_backups
      WHERE status = 'failed'
      AND error_message IS NOT NULL
      AND error_message != ''
      GROUP BY SUBSTRING_INDEX(error_message, ':', 1)
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;
    const errorDistribution = executeQuery(errorDistributionQuery);
    
    // Durasi backup rata-rata per hari
    const avgDurationQuery = `
      SELECT 
        DATE(start_time) as day,
        AVG(TIMESTAMPDIFF(SECOND, start_time, end_time)) as avg_duration_seconds
      FROM backup_sessions
      WHERE end_time IS NOT NULL
      AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(start_time)
      ORDER BY DATE(start_time)
    `;
    const avgDuration = executeQuery(avgDurationQuery);
    
    return {
      monthlyStats: monthlyStats,
      topUsers: topUsers,
      errorDistribution: errorDistribution,
      avgDuration: avgDuration
    };
  } catch (e) {
    Logger.log(`Error getting analytics data: ${e.toString()}`);
    return { error: e.toString() };
  }
}

/**
 * Endpoint untuk web app
 * @returns {HtmlOutput} - HTML output
 */
function doGet(e) {
  try {
    // Jika tidak ada parameter action, kembalikan halaman HTML utama
    if (!e.parameter.action) {
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('Database Backup Monitoring System')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    // Route berdasarkan parameter
    const action = e.parameter.action;
    let data = {};
    
    switch (action) {
      case 'dashboard':
        data = getDashboardData();
        break;
      case 'session':
        data = getSessionDetails(e.parameter.id);
        break;
      case 'userBackup':
        data = getUserBackupDetails(e.parameter.id);
        break;
      case 'search':
        data = searchSessions({
          startDate: e.parameter.startDate,
          endDate: e.parameter.endDate,
          status: e.parameter.status
        });
        break;
      case 'analytics':
        data = getAnalyticsData();
        break;
      default:
        data = { error: "Invalid action" };
    }
    
    // Return JSON data untuk API endpoints
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (e) {
    Logger.log(`Error in doGet: ${e.toString()}`);
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi untuk memproses request dari client
 */
function processRequest(action, params = {}) {
  try {
    switch (action) {
      case 'dashboard':
        return getDashboardData();
      case 'session':
        return getSessionDetails(params.id);
      case 'userBackup':
        return getUserBackupDetails(params.id);
      case 'search':
        return searchSessions(params);
      case 'analytics':
        return getAnalyticsData();
      default:
        return { error: "Invalid action" };
    }
  } catch (e) {
    Logger.log(`Error processing request: ${e.toString()}`);
    return { error: e.toString() };
  }
}
