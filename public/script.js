window.onload = function () {
    // [1] 오늘 날짜 자동 설정
    const dateInput = document.getElementById('matchDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // [2] 초기 데이터 로드 및 슬라이더 시작
    updateRankings();
    startSlider();
};

let currentSlide = 0;
const totalSlides = 2; // 주간, 월간 총 2세트

function startSlider() {
    const slider = document.getElementById('rankSlider');
    const dots = document.querySelectorAll('.dot');

    if (!slider) return;

    setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        const offset = currentSlide * -50; // 슬라이드 2개가 200%이므로 -50%씩 이동 (화면의 100%씩)

        slider.style.transform = `translateX(${offset}%)`;

        // 점(인디케이터) 업데이트
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }, 3000);
}

async function updateRankings() {
    try {
        const res = await fetch('/api/ranking/hall-of-fame');
        const { weekly, monthly } = await res.json();

        // 데이터가 없어도 틀이 깨지지 않게 처리
        if (weekly) {
            document.getElementById('wAvgName').innerText = weekly.week_avg_name || "-";
            document.getElementById('wAvgVal').innerText = weekly.week_avg_val ? parseFloat(weekly.week_avg_val).toFixed(2) + "점" : "0.00점";
            document.getElementById('wHighName').innerText = weekly.week_high_name || "-";
            document.getElementById('wHighVal').innerText = (weekly.week_high_val || 0) + "점";
        }

        if (monthly) {
            document.getElementById('mAvgName').innerText = monthly.month_avg_name || "-";
            document.getElementById('mAvgVal').innerText = monthly.month_avg_val ? parseFloat(monthly.month_avg_val).toFixed(2) + "점" : "0.00점";
            document.getElementById('mHighName').innerText = monthly.month_high_name || "-";
            document.getElementById('mHighVal').innerText = (monthly.month_high_val || 0) + "점";
        }
    } catch (e) { console.error(e); }
}

// [4] 점수 저장 및 결과 표시 (단 하나로 통합된 버전)
async function submitData() {
    const name = document.getElementById('playerName').value;
    const date = document.getElementById('matchDate').value;

    // 1. 점수 값 가져오기 (id가 g1, g2, g3라고 가정)
    const val1 = document.getElementById('g1').value;
    const val2 = document.getElementById('g2').value;
    const val3 = document.getElementById('g3').value;

    // 숫자로 변환
    const g1 = parseInt(val1) || 0;
    const g2 = parseInt(val2) || 0;
    const g3 = parseInt(val3) || 0;

    // 2. 유효성 검사 (이름 및 300점 제한)
    if (!name) return alert("이름을 입력해 주세요!");

    if (g1 > 300 || g2 > 300 || g3 > 300) {
        alert("볼링 점수는 300점을 넘을 수 없습니다. (퍼펙트 게임이 만점입니다!)");
        return; 
    }

    // 3. 유연한 게임 수 계산 (실제 입력된 것만 필터링)
    const scoreArray = [val1, val2, val3]
        .filter(s => s !== "" && !isNaN(s))
        .map(s => parseInt(s));

    if (scoreArray.length === 0) return alert("최소 1게임 이상의 점수를 입력해 주세요.");

    const total = scoreArray.reduce((acc, cur) => acc + cur, 0);
    const avg = (total / scoreArray.length).toFixed(2);

    try {
        const res = await fetch('/api/save-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_name: name,
                match_date: date,
                game_1: g1,
                game_2: g2,
                game_3: g3,
                daily_average: avg
            })
        });

        if (res.ok) {
            const resultArea = document.getElementById('resultArea');
            const avgDisplay = document.getElementById('avgDisplay');

            if (resultArea && avgDisplay) {
                resultArea.style.display = 'block';
                avgDisplay.innerText = `${avg}점`;
            }

            alert("저장 성공!");
            updateRankings(); // 상단 랭킹 업데이트

            // 입력칸 비우기
            document.getElementById('g1').value = '';
            document.getElementById('g2').value = '';
            document.getElementById('g3').value = '';
        }
    } catch (e) {
        alert("저장 중 오류가 발생했습니다.");
    }
}

function toggleDonation() {
    const modal = document.getElementById('donationModal');
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
}

// 계좌번호 복사 기능
function copyAccount() {
    const accountNumElement = document.getElementById('accountNum');
    if (!accountNumElement) return;
    const accountText = accountNumElement.innerText;

    // 모바일 대응 복사 로직
    const tempElem = document.createElement('textarea');
    tempElem.value = accountText.replace(/-/g, ""); // 하이픈 빼고 복사
    document.body.appendChild(tempElem);
    tempElem.select();
    document.execCommand('copy');
    document.body.removeChild(tempElem);

    alert("계좌번호가 복사되었습니다. 감사합니다! 🙇‍♂️");
}
