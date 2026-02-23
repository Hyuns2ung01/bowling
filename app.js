const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
    secret: 'bowling-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

const path = require('path');

app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'rootroot',
    database: 'bowling'
});

// 점수 저장 로직
app.post('/api/save-score', (req, res) => {
    const { match_date, player_name, game_1, game_2, game_3 } = req.body;
    const date = match_date || new Date().toISOString().slice(0, 10);

    const scores = [game_1, game_2, game_3]
        .map(s => parseInt(s))
        .filter(s => !isNaN(s) && s > 0);
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const avg = scores.length > 0 ? (totalScore / scores.length).toFixed(2) : 0;

    const sql = `INSERT INTO bowling_records (player_name, match_date, game_1, game_2, game_3, daily_average) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    db.query(sql, [player_name, date, game_1 || 0, game_2 || 0, game_3 || 0, avg], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('저장 실패');
        }
        res.send({ success: true, average: avg });
    });
});

app.get('/api/ranking/weekly', (req, res) => {
    const sql = `
        SELECT 
            player_name, 
            AVG(daily_average) AS weekly_avg
        FROM bowling_records 
        WHERE YEARWEEK(match_date, 1) = YEARWEEK(CURDATE(), 1)
        GROUP BY player_name
        ORDER BY weekly_avg DESC
        LIMIT 1;
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0] || { message: "이번 주 기록이 없습니다." });
    });
});

// 이번달 1등 에버리지 조회
app.get('/api/ranking/monthly', (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const sql = `
        SELECT 
            player_name, 
            AVG(daily_average) AS monthly_avg
        FROM bowling_records 
        WHERE DATE_FORMAT(match_date, '%Y-%m') = ?
        GROUP BY player_name
        ORDER BY monthly_avg DESC
        LIMIT 1;
    `;

    db.query(sql, [currentMonth], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0] || { message: "이번 달 기록이 없습니다." });
    });
});
// 날짜별 점수 조회 시스템
app.get('/api/ranking/daily', (req, res) => {
    const targetDate = req.query.date;
    const sql = `
        SELECT 
            id,
            player_name, 
            game_1, game_2, game_3, 
            daily_average
        FROM bowling_records 
        WHERE match_date = ?
        ORDER BY daily_average DESC;
    `;

    db.query(sql, [targetDate], (err, results) => {
        if (err) {
            console.error("데이터베이스 조회 중 실제 에러:", err);
            return res.status(500).json({ error: 'DB 조회 실패' });
        }
        res.json(results);
    });
});

// 관리자 로그인 API
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'ehfmfm') { // 실제 환경에선 환경 변수나 DB 연동 권장
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '되겠냐? ㅋ' });
    }
});

// 관리자 상태 체크 API
app.get('/api/admin/check', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
});

// 관리자 로그아웃 API
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 점수 수정 API (어드민 전용)
app.post('/api/admin/update-score', (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('권한이 없습니다.');

    const { id, player_name, game_1, game_2, game_3 } = req.body;

    const scores = [game_1, game_2, game_3].map(s => parseInt(s)).filter(s => !isNaN(s) && s > 0);
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const avg = scores.length > 0 ? (totalScore / scores.length).toFixed(2) : 0;

    const sql = `UPDATE bowling_records SET player_name=?, game_1=?, game_2=?, game_3=?, daily_average=? WHERE id=?`;

    db.query(sql, [player_name, game_1, game_2, game_3, avg, id], (err, result) => {
        if (err) return res.status(500).send('수정 실패');
        res.send({ success: true });
    });
});

// 점수 삭제 API (어드민 전용)
app.post('/api/admin/delete-score', (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('권한이 없습니다.');

    const { id } = req.body;
    const sql = `DELETE FROM bowling_records WHERE id=?`;

    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send('삭제 실패');
        res.send({ success: true });
    });
});

// 명예의 전당 통합 데이터 API
app.get('/api/ranking/hall-of-fame', (req, res) => {
    const weeklySql = `
        SELECT 
            (SELECT player_name FROM bowling_records WHERE YEARWEEK(match_date, 1) = YEARWEEK(CURDATE(), 1) ORDER BY daily_average DESC LIMIT 1) as week_avg_name,
            (SELECT MAX(daily_average) FROM bowling_records WHERE YEARWEEK(match_date, 1) = YEARWEEK(CURDATE(), 1)) as week_avg_val,
            (SELECT player_name FROM bowling_records WHERE YEARWEEK(match_date, 1) = YEARWEEK(CURDATE(), 1) ORDER BY GREATEST(game_1, game_2, game_3) DESC LIMIT 1) as week_high_name,
            (SELECT MAX(GREATEST(game_1, game_2, game_3)) FROM bowling_records WHERE YEARWEEK(match_date, 1) = YEARWEEK(CURDATE(), 1)) as week_high_val
    `;

    const monthlySql = `
        SELECT 
            (SELECT player_name FROM bowling_records WHERE DATE_FORMAT(match_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') ORDER BY daily_average DESC LIMIT 1) as month_avg_name,
            (SELECT AVG(daily_average) FROM bowling_records WHERE DATE_FORMAT(match_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') GROUP BY player_name ORDER BY AVG(daily_average) DESC LIMIT 1) as month_avg_val,
            (SELECT player_name FROM bowling_records WHERE DATE_FORMAT(match_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') ORDER BY GREATEST(game_1, game_2, game_3) DESC LIMIT 1) as month_high_name,
            (SELECT MAX(GREATEST(game_1, game_2, game_3)) FROM bowling_records WHERE DATE_FORMAT(match_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) as month_high_val
    `;

    db.query(`${weeklySql}; ${monthlySql}`, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json({ weekly: results[0][0], monthly: results[1][0] });
    });
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log('================================================');
    console.log(`볼링 관리 서버가 성공적으로 실행되었습니다!`);
    console.log(`접속 주소: http://localhost:${PORT}`);
    console.log('================================================');
});