import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { loginApi, withdrawUserApi, withdrawSocialUserApi } from '../api/auth/authApi';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCharacter, setHasCharacter] = useState(false);
    const [characterImageUrl, setCharacterImageUrl] = useState(null);
    const [incubatorCount, setIncubatorCount] = useState(null);
    const [isAdFree, setIsAdFree] = useState(false);
    const [characterCount, setCharacterCount] = useState(0);

    const logout = useCallback(() => {
        localStorage.removeItem('gmaking_token');
        localStorage.removeItem('has_character');
        localStorage.removeItem('characterImageUrl');
        localStorage.removeItem('incubatorCount');
        localStorage.removeItem('isAdFree');
        localStorage.removeItem('characterCount');
        localStorage.removeItem('user_nickname');

        setToken(null);
        setUser(null);
        setIsLoggedIn(false);
        setHasCharacter(false);
        setCharacterImageUrl(null);
        setIncubatorCount(null);
        setIsAdFree(false);
        setCharacterCount(0);
    }, []);

    // 부화권 갱신 함수 (applyNewToken의 의존성)
    const updateIncubatorCount = useCallback((opts) => {
        setIncubatorCount(prev => {
            let next = 0;
            if (opts?.set != null) {
                next = Number(opts.set);
            } else if (opts?.add != null) {
                next = Number(prev ?? 0) + Number(opts.add);
            } else {
                next = Number(prev ?? 0);
            }
            if (!Number.isFinite(next) || next < 0) next = 0;

            setUser(prevUser => prevUser ? { ...prevUser, incubatorCount: next } : prevUser);
            localStorage.setItem('incubatorCount', String(next));
            return next;
        });
    }, []);

    // 광고패스 갱신 함수 (applyNewToken의 의존성)
    const updateAdFree = useCallback(({ enabled } = {}) => {
        const bool =
            enabled === true || enabled === 'true' || enabled === 1 || enabled === '1';

        setIsAdFree(bool);
        setUser(prevUser => prevUser ? { ...prevUser, isAdFree: bool } : prevUser);
        localStorage.setItem('isAdFree', bool ? '1' : '0');
    }, []);


    useEffect(() => {
        const storedToken = localStorage.getItem('gmaking_token');
        const storedHasCharacter = localStorage.getItem('has_character') === 'true';
        const storedImage = localStorage.getItem('characterImageUrl');
        const storedIncubatorCountRaw = localStorage.getItem('incubatorCount');
        const storedIncubatorCount =
            Number.parseInt(localStorage.getItem('incubatorCount') ?? '0', 10) || 0;
        const storedIsAdFree = localStorage.getItem('isAdFree');
        const isAdFreeFromStorage =
            storedIsAdFree === '1' || storedIsAdFree === 'true';
        
        const storedCharacterCount = 
            Number.parseInt(localStorage.getItem('characterCount') ?? '0', 10) || 0;

        const storedNickname = localStorage.getItem('user_nickname');

        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        try {
            const userPayload = jwtDecode(storedToken);
            const now = Date.now() / 1000;

            // JWT 만료 체크
            if (userPayload.exp && userPayload.exp < now) {
                console.log('🔸 JWT expired — clearing token');
                logout();
                return;
            }

            // 사용자 정보 세팅
            const currentUser = {
                userId: userPayload.userId,
                userEmail: userPayload.userEmail,
                role: userPayload.role,
                userName: userPayload.userName || userPayload.name,
                userNickname: storedNickname || userPayload.userNickname || userPayload.nickname,
                hasCharacter:
                    userPayload.hasCharacter === true ||
                    userPayload.hasCharacter === 'true' ||
                    storedHasCharacter,
                characterImageUrl:
                    userPayload.characterImageUrl 
                        ? userPayload.characterImageUrl 
                        : (storedImage && storedImage.trim() !== '') 
                            ? storedImage 
                            : null,
                incubatorCount: (Number.parseInt(localStorage.getItem('incubatorCount') ?? '0', 10) || 0),
                isAdFree:
                    userPayload.isAdFree === true ||
                    userPayload.isAdFree === 'true' ||
                    isAdFreeFromStorage,
                characterCount: userPayload.characterCount != null 
                    ? Number(userPayload.characterCount) 
                    : storedCharacterCount,
            };

            if (!currentUser.userId) {
                throw new Error("JWT payload is missing a critical userId.");
            }

            setToken(storedToken);
            setIsLoggedIn(true);
            setUser(currentUser);
            setHasCharacter(currentUser.hasCharacter);
            setCharacterImageUrl(currentUser.characterImageUrl);
            setIncubatorCount(currentUser.incubatorCount);
            setIsAdFree(currentUser.isAdFree);
            setCharacterCount(currentUser.characterCount);
            setIsLoading(false);

        } catch (error) {
            console.error('JWT 디코딩 실패 또는 사용자 정보 오류:', error);
            logout();
            setIsLoading(false);
        }
    }, [logout, token]);

    // 로그인
    const login = async (userId, userPassword) => {
        try {
            const response = await loginApi(userId, userPassword);

            console.log("Login API 응답 전체:", response.data);
            console.log("userInfo.userNickname:", response.data?.userInfo?.userNickname);
            if (response.data && response.data.success) {
                const { token: receivedToken, userInfo } = response.data;

                const userWithCharStatus = {
                    ...userInfo,
                    hasCharacter: userInfo.hasCharacter || false,
                    characterImageUrl: userInfo.characterImageUrl || null,
                    incubatorCount: userInfo.incubatorCount || null,
                    isAdFree: userInfo.isAdFree || false,
                    characterCount: userInfo.characterCount || 0,
                };

                if (userWithCharStatus.userNickname) {
                    localStorage.setItem('user_nickname', userWithCharStatus.userNickname);
                }

                setToken(receivedToken);
                setUser(userWithCharStatus);
                setIsLoggedIn(true);
                setHasCharacter(userWithCharStatus.hasCharacter);
                setCharacterImageUrl(userWithCharStatus.characterImageUrl);
                setIncubatorCount(userWithCharStatus.incubatorCount);
                setIsAdFree(userWithCharStatus.isAdFree);
                setCharacterCount(userWithCharStatus.characterCount);

                localStorage.setItem('gmaking_token', receivedToken);

                if (userWithCharStatus.characterImageUrl && userWithCharStatus.characterImageUrl.trim() !== '') {
                    localStorage.setItem('characterImageUrl', userWithCharStatus.characterImageUrl.trim());
                } else {
                    localStorage.removeItem('characterImageUrl'); // NULL이면 제거
                }

                localStorage.setItem('has_character', userWithCharStatus.hasCharacter ? 'true' : 'false');
                localStorage.setItem('incubatorCount', String(userWithCharStatus.incubatorCount ?? 0));
                localStorage.setItem('isAdFree', userWithCharStatus.isAdFree ? '1' : '0');
                localStorage.setItem('characterCount', String(userWithCharStatus.characterCount ?? 0));

                return true;
            } else {
                alert(response.data?.message || '로그인 실패');
                return false;
            }
        } catch (error) {
            console.error('Login Error:', error);
            alert(error.response?.data?.message || '로그인 중 오류가 발생했습니다.');
            return false;
        }
    };

    // 회원 탈퇴
    const withdrawUser = useCallback(async (userId, userPassword) => {
        if (!token) {
            alert("인증 토큰이 없습니다. 다시 로그인 해주세요.");
            return false;
        }

        try {
            let response;
            if (userPassword) {
                console.log(`[Withdraw] 일반 회원 탈퇴 시도: ${userId}`);
                response = await withdrawUserApi(token, userId, userPassword);
            } else {
                console.log(`[Withdraw] 소셜 회원 탈퇴 시도: ${userId}`);
                response = await withdrawSocialUserApi(token);
            }

            if (response.data.success) {
                alert(response.data.message);
                logout();
                return true;
            } else {
                alert(`탈퇴 실패: ${response.data.message}`);
                return false;
            }

        } catch (error) {
            console.error("탈퇴 요청 오류:", error);
            alert(`탈퇴 실패: ${error.response?.data?.message || '계정 탈퇴 처리 중 오류가 발생했습니다.'}`);
            return false;
        }
    }, [token, logout]);

    // OAuth2 로그인 처리
    const handleOAuth2Login = useCallback((receivedToken, userInfo) => {
        const isUserWithCharacter =
            userInfo.hasCharacter === true || userInfo.hasCharacter === 'true';

        const imageUrl = userInfo.characterImageUrl || null;

        const incubatorCount =
            userInfo?.incubatorCount != null && !Number.isNaN(Number(userInfo.incubatorCount))
                ? Number(userInfo.incubatorCount)
                : (Number.parseInt(localStorage.getItem('incubatorCount') ?? '0', 10) || 0);

        const isUserAdFree =
            userInfo?.isAdFree === true || userInfo?.isAdFree === 'true';
        
        const charCount = 
        userInfo?.characterCount != null && !Number.isNaN(Number(userInfo.characterCount))
            ? Number(userInfo.characterCount)
            : (Number.parseInt(localStorage.getItem('characterCount') ?? '0', 10) || 0);

        const userWithCharStatus = {
            ...userInfo,
            hasCharacter: isUserWithCharacter,
            characterImageUrl: imageUrl,
            isAdFree: isUserAdFree,
            incubatorCount,
            characterCount: charCount,
        };

        if (userWithCharStatus.userNickname) {
            localStorage.setItem('user_nickname', userWithCharStatus.userNickname);
        }

        setToken(receivedToken);
        setUser(userWithCharStatus);
        setIsLoggedIn(true);
        setHasCharacter(userWithCharStatus.hasCharacter);
        setCharacterImageUrl(userWithCharStatus.characterImageUrl);
        setIncubatorCount(userWithCharStatus.incubatorCount);
        setIsAdFree(userWithCharStatus.isAdFree);
        setCharacterCount(userWithCharStatus.characterCount);

        localStorage.setItem('gmaking_token', receivedToken);

        if (imageUrl && String(imageUrl).trim() !== '') {
            localStorage.setItem('characterImageUrl', String(imageUrl).trim());
        } else {
             localStorage.removeItem('characterImageUrl'); // NULL이면 제거
        }

        localStorage.setItem('has_character', isUserWithCharacter ? 'true' : 'false');
        localStorage.setItem('incubatorCount', String(incubatorCount ?? 0));
        localStorage.setItem('isAdFree', isUserAdFree ? '1' : '0');
        localStorage.setItem('characterCount', String(charCount ?? 0));
    }, []);

    // 문제
    const setCharacterCreated = useCallback((imageUrl) => {
        setHasCharacter(true);
        setCharacterImageUrl(imageUrl);

        localStorage.setItem('has_character', 'true');

        if (imageUrl && imageUrl.trim() !== '') {
            localStorage.setItem('characterImageUrl', imageUrl);
        } else {
            localStorage.removeItem('characterImageUrl');
        }


        if (user) {
            setUser(prev => ({
                ...prev,
                hasCharacter: true,
                characterImageUrl: imageUrl
            }));
        }
    }, [user]);

    const updateUserNickname = useCallback((newNickname) => {
        localStorage.setItem('user_nickname', newNickname);
        setUser(prevUser => {
            if (!prevUser) return null;
            return {
                ...prevUser,
                userNickname: newNickname,
            };
        });
    }, []);

    // 대표 캐릭터 변경 후 이미지 URL 갱신
    const updateRepresentativeCharacter = useCallback((imageUrl, characterId) => {
        if (imageUrl && String(imageUrl).trim() !== '') {
            localStorage.setItem('characterImageUrl', String(imageUrl).trim());
        } else {
            localStorage.removeItem('characterImageUrl');
        }

        setCharacterImageUrl(imageUrl);
        setHasCharacter(true);

        // user 상태도 함께 갱신
        if (user) {
            setUser(prev => ({
                ...prev,
                characterImageUrl: imageUrl,
                hasCharacter: true,
                characterId: characterId,
            }));
        }
    }, [user]);

    // applyNewToken 함수: 토큰에서 hasCharacter와 characterImageUrl을 추출하여 갱신
    const applyNewToken = useCallback(
        (newToken) => {
            if (!newToken) return;
            
            // 토큰을 로컬 스토리지에 저장하고 상태에 반영
            localStorage.setItem('gmaking_token', newToken);
            setToken(newToken);

            try {
                const p = jwtDecode(newToken);
                
                // hasCharacter 갱신 (캐릭터 생성 여부)
                const newHasCharacter = p?.hasCharacter === true || p?.hasCharacter === 'true';
                setHasCharacter(newHasCharacter);
                localStorage.setItem('has_character', newHasCharacter ? 'true' : 'false');

                // characterImageUrl 갱신 (대표 캐릭터 설정 여부)
                const newCharacterImageUrl = p?.characterImageUrl || null;
                setCharacterImageUrl(newCharacterImageUrl);
                
                if (newCharacterImageUrl && String(newCharacterImageUrl).trim() !== '') {
                    localStorage.setItem('characterImageUrl', String(newCharacterImageUrl).trim());
                } else {
                    localStorage.removeItem('characterImageUrl'); // NULL이면 로컬 스토리지에서 제거
                }

                const newCharacterCount = p?.characterCount != null ? Number(p.characterCount) : null;

                if (p?.incubatorCount != null) {
                    updateIncubatorCount({ set: Number(p.incubatorCount) });
                }
                if (typeof p?.isAdFree !== 'undefined') {
                    updateAdFree({ enabled: p.isAdFree });
                }
                if (newCharacterCount != null) {
                    setCharacterCount(newCharacterCount); 
                    localStorage.setItem('characterCount', String(newCharacterCount)); 
                }

                setUser((prev) =>
                    prev
                        ? {
                            ...prev,
                            // user 객체에도 hasCharacter와 characterImageUrl 갱신
                            hasCharacter: newHasCharacter, 
                            characterImageUrl: newCharacterImageUrl,
                            incubatorCount:
                                p?.incubatorCount != null ? Number(p.incubatorCount) : prev.incubatorCount,
                            isAdFree:
                                typeof p?.isAdFree !== 'undefined' ? !!p.isAdFree : prev.isAdFree,
                            characterCount: newCharacterCount != null ? newCharacterCount : prev.characterCount,
                        }
                        : prev
                );
            } catch (e) {
                console.warn('[applyNewToken] decode failed', e);
            }
        },
        // 의존성 배열에 모든 상태 Setter 함수 추가
        [setHasCharacter, setCharacterImageUrl, setToken, setUser, updateIncubatorCount, updateAdFree, setCharacterCount]
    );

    return (
        <AuthContext.Provider value={{
            isLoggedIn, token, user, isLoading,
            hasCharacter, characterImageUrl, incubatorCount, isAdFree, characterCount,
            login, logout,
            setCharacterCreated,
            withdrawUser, handleOAuth2Login,
            updateUserNickname, updateRepresentativeCharacter, setToken,
            updateIncubatorCount, updateAdFree, applyNewToken,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);