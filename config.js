// config.js

// [최종 수정] ABI는 JSON 파일에서 직접 import하여 사용합니다.
import contractABI_JSON from './src/abi/TeeNFT.json';

const config = {
    // 1. 스마트 컨트랙트 주소 (환경변수에서 가져옴)
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,

    // 2. Pinata API 키 (환경변수에서 가져옴)
    PINATA_JWT: import.meta.env.VITE_PINATA_JWT,

    // 3. Alchemy API 키 (환경변수에서 가져옴)
    ALCHEMY_API_KEY: import.meta.env.VITE_ALCHEMY_API_KEY,

    // 4. 스마트 컨트랙트 ABI (JSON 파일을 직접 사용)
    contractABI: contractABI_JSON,
};

export default config;
