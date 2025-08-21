// config.js

// [수정] 이 파일은 이제 로컬 개발(.env.local)과 Netlify 배포 환경 모두에서
// 환경 변수를 안전하게 불러오는 역할을 합니다.

const config = {
    // 1. 스마트 컨트랙트 주소 (환경변수에서 가져옴)
    // Vite는 `import.meta.env.VITE_...` 형식으로 환경변수를 불러옵니다.
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,

    // 2. Pinata API 키 (환경변수에서 가져옴)
    PINATA_JWT: import.meta.env.VITE_PINATA_JWT,

    // 3. Alchemy API 키 (환경변수에서 가져옴)
    ALCHEMY_API_KEY: import.meta.env.VITE_ALCHEMY_API_KEY,

    // 4. 스마트 컨트랙트 ABI (환경변수에서 가져옴)
    // ABI는 매우 긴 문자열이므로, JSON.parse를 사용하여 객체로 변환합니다.
    // 환경변수가 없을 경우를 대비하여 기본값으로 빈 배열('[]')을 설정합니다.
    contractABI: JSON.parse(import.meta.env.VITE_CONTRACT_ABI || '[]'),
};

export default config;
