// --- 라이브러리, CSS 및 설정 파일 import ---
import { Alchemy, Network } from 'alchemy-sdk';
import { ethers } from 'ethers';
import axios from 'axios';
import config from './config.js';
import './style.css'; // *** 변경점: CSS 파일을 JavaScript에서 직접 import 합니다. ***

// --- 전역 변수 ---
let provider;
let signer;
let currentAccount;
let contract;
let alchemy;

// --- DOM 요소 ---
// 기존 요소
const connectWalletBtn = document.getElementById('connect-wallet-btn');
const walletAddressSpan = document.getElementById('wallet-address');
const mintForm = document.getElementById('mint-form');
const mintBtn = document.getElementById('mint-btn');
const mintStatusDiv = document.getElementById('mint-status');
const nftListDiv = document.getElementById('nft-list');
const loadingIndicator = document.getElementById('loading-indicator');
const showAllBtn = document.getElementById('show-all-btn');
const showMyBtn = document.getElementById('show-my-btn');

// *** 추가점: 모달 관련 DOM 요소 ***
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalNftImage = document.getElementById('modal-nft-image');
const modalNftName = document.getElementById('modal-nft-name');
const modalNftDescription = document.getElementById('modal-nft-description');
const modalTokenId = document.getElementById('modal-token-id');
const modalNftPrice = document.getElementById('modal-nft-price');
const modalNftStatus = document.getElementById('modal-nft-status');
const modalCreatorAddress = document.getElementById('modal-creator-address');
const modalOwnerAddress = document.getElementById('modal-owner-address');
const modalCreatedAt = document.getElementById('modal-created-at');
const modalIpfsLink = document.getElementById('modal-ipfs-link');
const redeemBtn = document.getElementById('redeem-btn');
const redeemStatus = document.getElementById('redeem-status');


function initialize() {
    console.log("페이지 초기화 시작됨.");

    const settings = {
        apiKey: config.ALCHEMY_API_KEY,
        network: Network.BASE_SEPOLIA,
    };
    alchemy = new Alchemy(settings);
    console.log("Alchemy SDK 초기화 완료!");

    // 이벤트 리스너 연결
    connectWalletBtn.addEventListener('click', connectWallet);
    mintForm.addEventListener('submit', mintNFT);
    showAllBtn.addEventListener('click', () => loadNFTs('all'));
    showMyBtn.addEventListener('click', () => loadNFTs('my'));

    // *** 추가점: 모달 닫기 이벤트 리스너 ***
    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    });
}

async function connectWallet() {
    console.log("지갑 연결 시도...");
    if (typeof window.ethereum === 'undefined') {
        alert('MetaMask를 설치해주세요!');
        return;
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        currentAccount = await signer.getAddress();
        contract = new ethers.Contract(config.contractAddress, config.contractABI, provider);

        walletAddressSpan.textContent = `${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}`;
        connectWalletBtn.textContent = '연결됨';
        connectWalletBtn.disabled = true;
        console.log(`지갑 연결 성공: ${currentAccount}`);
        await loadNFTs('my');
    } catch (error) {
        console.error("지갑 연결 실패:", error);
        alert("지갑 연결에 실패했습니다. 다시 시도해주세요.");
    }
}

function updateMintStatus(message, isError = false) {
    mintStatusDiv.textContent = message;
    mintStatusDiv.style.display = 'block';
    mintStatusDiv.style.backgroundColor = isError ? '#ffebee' : '#e0f7fa';
    mintStatusDiv.style.borderColor = isError ? '#ffcdd2' : '#b2ebf2';
}

async function uploadFileToIPFS(file) {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append("file", file);
    try {
        const response = await axios.post(url, data, {
            maxContentLength: "Infinity",
            headers: { "Content-Type": `multipart/form-data; boundary=${data._boundary}`, Authorization: `Bearer ${config.PINATA_JWT}` },
        });
        return response.data.IpfsHash;
    } catch (error) { console.error("Error uploading file to IPFS:", error); return null; }
}

async function uploadJsonToIPFS(jsonObject) {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    try {
        const response = await axios.post(url, jsonObject, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.PINATA_JWT}` } });
        return response.data.IpfsHash;
    } catch (error) { console.error("Error uploading JSON to IPFS:", error); return null; }
}

async function mintNFT(event) {
    event.preventDefault();
    if (!signer) { alert("지갑을 먼저 연결해주세요."); return; }

    const imageFile = document.getElementById('nft-image').files[0];
    const name = document.getElementById('nft-name').value;
    const description = document.getElementById('nft-description').value;
    const price = document.getElementById('nft-price').value;

    if (!imageFile || !name || !description || price === '') { alert("모든 필드를 채워주세요."); return; }
    
    mintBtn.disabled = true;
    mintBtn.textContent = '발행 중...';
    try {
        updateMintStatus("1. 이미지를 IPFS에 업로드 중입니다...");
        const imageCID = await uploadFileToIPFS(imageFile);
        if (!imageCID) throw new Error("이미지 업로드 실패");
        const imageIpfsUrl = `ipfs://${imageCID}`;
        
        updateMintStatus("2. 메타데이터를 IPFS에 업로드 중입니다...");
        const metadata = { name, description, image: imageIpfsUrl, attributes: [] };
        const metadataCID = await uploadJsonToIPFS(metadata);
        if (!metadataCID) throw new Error("메타데이터 업로드 실패");
        const metadataIpfsUrl = `ipfs://${metadataCID}`;

        updateMintStatus("3. MetaMask에서 트랜잭션을 확인해주세요...");
        const contractWithSigner = contract.connect(signer);
        
        const priceInWei = ethers.parseEther(price);

        const tx = await contractWithSigner.safeMint(currentAccount, metadataIpfsUrl, priceInWei);
        
        updateMintStatus("4. 블록체인에 기록 중입니다...");
        const receipt = await tx.wait();

        let tokenId = null;
        for (const log of receipt.logs) {
            try {
                const parsedLog = contract.interface.parseLog(log);
                if (parsedLog && parsedLog.name === "Transfer") { tokenId = parsedLog.args.tokenId; break; }
            } catch (error) { /* 무시 */ }
        }
        if (tokenId === null) throw new Error("민팅 트랜잭션은 성공했으나, Token ID를 찾지 못했습니다.");
        
        const successMessage = `✅ NFT 발행 성공! Token ID: ${tokenId.toString()}`;
        updateMintStatus(successMessage);
        alert(successMessage);
        await loadNFTs(showMyBtn.classList.contains('active') ? 'my' : 'all');
        
    } catch (error) {
        console.error("NFT 발행 실패:", error);
        updateMintStatus(`❌ 발행 실패: ${error.message}`, true);
        alert(`NFT 발행에 실패했습니다: ${error.message}`);
    } finally {
        mintBtn.disabled = false;
        mintBtn.textContent = 'NFT 발행하기';
        document.getElementById('mint-form').reset();
    }
}

async function loadNFTs(filterType) {
    if (!alchemy || !contract) {
        alert("지갑을 먼저 연결하고 시도해주세요.");
        return;
    }
    loadingIndicator.style.display = 'block';
    nftListDiv.innerHTML = '';
    showAllBtn.classList.toggle('active', filterType === 'all');
    showMyBtn.classList.toggle('active', filterType === 'my');
    loadingIndicator.textContent = `NFT 목록을 불러오는 중... (${filterType === 'all' ? '전체' : '내 컬렉션'})`;
    try {
        let nftsFromAlchemy;
        if (filterType === 'my') {
            const response = await alchemy.nft.getNftsForOwner(currentAccount, { contractAddresses: [config.contractAddress] });
            nftsFromAlchemy = response.ownedNfts;
        } else {
            const response = await alchemy.nft.getNftsForContract(config.contractAddress);
            nftsFromAlchemy = response.nfts;
        }
        if (nftsFromAlchemy.length === 0) {
            loadingIndicator.textContent = `${filterType === 'my' ? '보유한' : '발행된'} NFT가 없습니다.`;
            return;
        }
        const nftPromises = nftsFromAlchemy.map(nft => fetchNFTData(nft));
        const nfts = (await Promise.all(nftPromises)).filter(nft => nft !== null);
        displayNFTs(nfts);
    } catch (error) {
        console.error("Alchemy SDK로 NFT 목록을 불러오는 데 실패했습니다:", error);
        loadingIndicator.textContent = "NFT 목록을 불러오는 데 실패했습니다.";
    }
}

function displayNFTs(nfts) {
    nftListDiv.innerHTML = '';
    loadingIndicator.style.display = 'none';
    if (nfts.length === 0) {
        nftListDiv.innerHTML = `<p>표시할 NFT가 없습니다.</p>`;
        return;
    }
    nfts.forEach(nft => {
        const nftCard = createNFTCard(nft);
        nftListDiv.appendChild(nftCard);
    });
}

async function fetchNFTData(alchemyNFT) {
    try {
        const tokenId = alchemyNFT.tokenId;
        const owner = (await alchemy.nft.getOwnersForNft(config.contractAddress, tokenId)).owners[0];
        const teeNFTData = await contract.getTeeNFTData(tokenId);

        return {
            tokenId: tokenId,
            name: alchemyNFT.name || `TeeNFT #${tokenId}`,
            description: alchemyNFT.description || '',
            image: alchemyNFT.image?.cachedUrl || alchemyNFT.image?.originalUrl || 'https://placehold.co/600x400?text=Image+Not+Found',
            owner,
            creator: teeNFTData.creator,
            createdAt: new Date(Number(teeNFTData.createdAt) * 1000).toLocaleDateString(),
            status: teeNFTData.status === 0n ? '교환 가능' : '교환 완료', // 0n은 BigInt 0을 의미
            price: ethers.formatEther(teeNFTData.price), // wei 단위를 ETH 단위 문자열로 변환
            tokenUri: alchemyNFT.tokenUri // IPFS 링크를 위해 추가
        };
    } catch (error) {
        console.error(`Token ID ${alchemyNFT.tokenId}의 데이터를 가져오는 데 실패했습니다:`, error);
        return null;
    }
}

function createNFTCard(nft) {
    const card = document.createElement('div');
    card.className = 'nft-card';
    card.innerHTML = `
        <img src="${nft.image}" alt="${nft.name}" class="nft-image" onerror="this.src='https://placehold.co/600x400?text=Image+Not+Found'">
        <div class="nft-info">
            <h3 class="nft-name">${nft.name} (#${nft.tokenId})</h3>
            <p class="nft-owner">소유자: ${nft.owner.substring(0, 6)}...${nft.owner.substring(nft.owner.length - 4)}</p>
            <p class="nft-status">상태: <span class="status-${nft.status === '교환 가능' ? 'redeemable' : 'redeemed'}">${nft.status}</span></p>
            <p class="nft-price">가격: ${nft.price} ETH</p>
        </div>
    `;
    card.addEventListener('click', () => showNFTDetail(nft));
    return card;
}

async function showNFTDetail(nft) {
    // 모달에 정보 채우기
    modalNftImage.src = nft.image;
    modalNftName.textContent = `${nft.name} (#${nft.tokenId})`;
    modalNftDescription.textContent = nft.description || '설명이 없습니다.';
    modalTokenId.textContent = nft.tokenId;
    modalNftPrice.textContent = nft.price;
    modalNftStatus.textContent = nft.status;
    modalCreatorAddress.textContent = nft.creator;
    modalOwnerAddress.textContent = nft.owner;
    modalCreatedAt.textContent = nft.createdAt;

    // IPFS 링크 설정
    if (nft.tokenUri) {
        const ipfsGatewayUrl = nft.tokenUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        modalIpfsLink.href = ipfsGatewayUrl;
        modalIpfsLink.style.display = 'block';
    } else {
        modalIpfsLink.style.display = 'none';
    }

    // 교환 버튼 로직
    redeemStatus.textContent = '';
    redeemBtn.classList.add('hidden');
    redeemBtn.onclick = null; 

    if (nft.owner === currentAccount && nft.status === '교환 가능') {
        redeemBtn.classList.remove('hidden');
        redeemBtn.disabled = false;
        redeemBtn.textContent = '실물 티셔츠로 교환하기';
        redeemBtn.onclick = () => redeemNFT(nft.tokenId);
    }

    modalOverlay.classList.remove('hidden');
}

async function redeemNFT(tokenId) {
    redeemBtn.disabled = true;
    redeemStatus.textContent = '교환 처리 중... MetaMask를 확인해주세요.';

    try {
        const contractWithSigner = contract.connect(signer);
        const tx = await contractWithSigner.redeem(tokenId);
        redeemStatus.textContent = '블록체인에 기록 중입니다...';
        await tx.wait();

        alert('✅ 교환이 성공적으로 완료되었습니다!');
        modalOverlay.classList.add('hidden');
        await loadNFTs(showMyBtn.classList.contains('active') ? 'my' : 'all'); 

    } catch (error) {
        console.error("교환 실패:", error);
        alert(`❌ 교환에 실패했습니다: ${error.reason || error.message}`);
        redeemStatus.textContent = `오류: ${error.reason || error.message}`;
        redeemBtn.disabled = false;
    }
}

initialize();
