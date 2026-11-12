import CinemaLogin from './cinema/CinemaLogin';
import React, { useState, useRef, useEffect } from "react";
import { TextInput, Alert, Keyboard, InteractionManager } from "react-native";
import { usePathname } from "expo-router";
import Toast from "react-native-toast-message";
import useAuthStore from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import useHomeStore from "@/stores/homeStore";
import { api } from "@/services/api";
import { LoginCredentialsManager } from "@/services/storage";

const LoginModal = () => {
  const { isLoginModalVisible, hideLoginModal, checkLoginStatus } = useAuthStore();
  const { serverConfig, apiBaseUrl } = useSettingsStore();
  const { refreshPlayRecords } = useHomeStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const pathname = usePathname();
  const isSettingsPage = pathname.includes("settings");

  const [isModalReady, setIsModalReady] = useState(false);

  // Load saved credentials when modal opens
  useEffect(() => {
    if (isLoginModalVisible && !isSettingsPage) {
            // 先确保键盘状态清理
      Keyboard.dismiss();

      const loadCredentials = async () => {
        const savedCredentials = await LoginCredentialsManager.get();
        if (savedCredentials) {
          setUsername(savedCredentials.username);
          setPassword(savedCredentials.password);
        }
      };
      loadCredentials();

      // 延迟设置 Modal 就绪状态
      const readyTimeout = setTimeout(() => {
        setIsModalReady(true);
      }, 300);

      return () => {
        clearTimeout(readyTimeout);
        setIsModalReady(false);
      };
    }
  }, [isLoginModalVisible, isSettingsPage]);

  // Focus management with better TV remote handling
  useEffect(() => {
    if (isModalReady && isLoginModalVisible && !isSettingsPage) {
      const isUsernameVisible = serverConfig?.StorageType !== "localstorage";

      // Use a small delay to ensure the modal is fully rendered
      const focusTimeout = setTimeout(() => {
        if (isUsernameVisible) {
          usernameInputRef.current?.focus();
        } else {
          passwordInputRef.current?.focus();
        }
      }, 300);

      return () => clearTimeout(focusTimeout);
    }
  }, [isModalReady, isLoginModalVisible, serverConfig, isSettingsPage]);

  // 清理 effect - 确保 Modal 关闭时清理所有状态
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
      setIsModalReady(false);
    };
  }, []);

  const handleLogin = async () => {
    const isLocalStorage = serverConfig?.StorageType === "localstorage";
    if (!password || (!isLocalStorage && !username)) {
      Toast.show({ type: "error", text1: "请输入用户名和密码" });
      return;
    }
    if (isLoading) return;
    setLoginError('');
    setIsLoading(true);
    try {
      await api.login(isLocalStorage ? undefined : username, password);
      await checkLoginStatus(apiBaseUrl);
      await refreshPlayRecords();

      // Save credentials on successful login
      await LoginCredentialsManager.save({ username, password });

      Toast.show({ type: "success", text1: "登录成功" });
      // hideLoginModal();

      // // Show disclaimer alert after successful login
      // Alert.alert(
      //   "免责声明",
      //   "本应用仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。",
      //   [{ text: "确定" }]
      // );

            // 在登录成功后清理状态，再显示 Alert
      const hideAndAlert = () => {
        hideLoginModal();
        setIsModalReady(false);
        Keyboard.dismiss();

        setTimeout(() => {
          Alert.alert(
            "免责声明",
            "本应用仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。",
            [{ text: "确定" }]
          );
        }, 100);
      };

      // 使用 InteractionManager 确保 UI 稳定后再执行
      InteractionManager.runAfterInteractions(hideAndAlert);

    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '用户名或密码错误，请重试。');
      Toast.show({
        type: "error",
        text1: "登录失败",
        text2: error instanceof Error ? error.message : "用户名或密码错误",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return <CinemaLogin visible={isLoginModalVisible && !isSettingsPage} username={username} password={password} needsUsername={serverConfig?.StorageType !== 'localstorage'} loading={isLoading} error={loginError} onUsername={setUsername} onPassword={setPassword} onLogin={handleLogin} onClose={() => { Keyboard.dismiss(); hideLoginModal(); }} usernameRef={usernameInputRef} passwordRef={passwordInputRef} />;
};
export default LoginModal;
