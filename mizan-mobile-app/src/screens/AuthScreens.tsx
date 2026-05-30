import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Eye, EyeOff } from "lucide-react-native";
import { Screen } from "../components/screen";
import { Button, ErrorBanner, Field, styles as uiStyles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { authApi, getApiErrorMessage } from "../lib/api";
import type { AuthStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

const logo = require("../../assets/MIZAN_FULL_LOGO.png");

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <View style={styles.brand}>
        <Image source={logo} resizeMode="contain" style={styles.logo} />
      </View>
      {children}
      <View style={styles.security}>
        <View style={styles.securityDot} />
        <Text style={styles.securityText}>Secure system</Text>
      </View>
    </Screen>
  );
}

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Login">) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getApiErrorMessage(err, "Incorrect email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Welcome</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>Sign in to find your balance.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          value={email}
        />
        <View>
          <View style={styles.passwordLabelRow}>
            <Text style={uiStyles.label}>Password</Text>
            <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
          <View style={styles.passwordInputWrap}>
            <Field
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              style={{ paddingRight: 52 }}
              value={password}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
              {showPassword ? <EyeOff color={colors.muted} size={20} /> : <Eye color={colors.muted} size={20} />}
            </Pressable>
          </View>
        </View>
        <Button loading={loading} disabled={!email || !password} onPress={submit}>
          Sign in
        </Button>
        <Pressable onPress={() => navigation.navigate("Activate")} style={styles.centerPress}>
          <Text style={uiStyles.muted}>
            New to Mizan? <Text style={styles.linkStrong}>Activate my account</Text>
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

export function ActivateScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Activate">) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await authApi.requestActivation({ email: email.trim() });
      navigation.navigate("VerifyOtp", { email: email.trim() });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send code. Please check your email address."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Activate my account</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>
            Enter your academic email address to receive an activation code.
          </Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="your.email@school.edu"
          value={email}
        />
        <Button loading={loading} disabled={!email} onPress={submit}>
          Get the code
        </Button>
      </View>
    </AuthShell>
  );
}

export function VerifyOtpScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParamList, "VerifyOtp">) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const digits = useMemo(() => otp.padEnd(6, " ").slice(0, 6).split(""), [otp]);

  const submit = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await authApi.verifyOtp({ email: route.params.email, otp });
      navigation.navigate("SetPassword", { tempToken: res.temp_token });
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Verification</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>Enter the 6-digit code sent to {route.params.email}.</Text>
        </View>
        <ErrorBanner message={error} />
        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <View key={index} style={styles.otpBox}>
              <Text style={styles.otpText}>{digit.trim()}</Text>
            </View>
          ))}
        </View>
        <Field
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          value={otp}
        />
        <Button loading={loading} disabled={otp.length !== 6} onPress={submit}>
          Verify code
        </Button>
      </View>
    </AuthShell>
  );
}

export function SetPasswordScreen({
  route,
}: NativeStackScreenProps<AuthStackParamList, "SetPassword">) {
  const { setTokens } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = password.length >= 8 && password === confirmPassword;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const tokens = await authApi.setPassword({
        token: route.params.tempToken,
        new_password: password,
      });
      await setTokens(tokens);
    } catch (err) {
      setError(getApiErrorMessage(err, "Error creating password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Create your password</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>Choose a secure password for your Mizan account.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          label="Password"
          onChangeText={setPassword}
          placeholder="8 characters minimum"
          secureTextEntry
          value={password}
        />
        <Field
          label="Confirm password"
          onChangeText={setConfirmPassword}
          placeholder="Confirm your password"
          secureTextEntry
          value={confirmPassword}
        />
        <Text style={canSubmit ? styles.requirementOk : uiStyles.muted}>
          8 characters minimum and matching passwords
        </Text>
        <Button loading={loading} disabled={!canSubmit} onPress={submit}>
          Create my account
        </Button>
      </View>
    </AuthShell>
  );
}

export function ForgotPasswordScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "ForgotPassword">) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword({ email: email.trim() });
      navigation.navigate("VerifyResetOtp", { email: email.trim() });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send reset code."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Reset password</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>We will email you a verification code.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field label="Email address" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} value={email} />
        <Button loading={loading} disabled={!email.trim()} onPress={submit}>Send code</Button>
        <Pressable onPress={() => navigation.navigate("Login")} style={styles.centerPress}>
          <Text style={styles.linkStrong}>Back to sign in</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

export function VerifyResetOtpScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParamList, "VerifyResetOtp">) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.verifyResetOtp({ email: route.params.email, otp: otp.trim() });
      navigation.navigate("ResetPassword", { tempToken: res.temp_token });
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>Verify code</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>Enter the 6-digit code sent to {route.params.email}</Text>
        </View>
        <ErrorBanner message={error} />
        <Field label="Verification code" keyboardType="number-pad" onChangeText={setOtp} value={otp} maxLength={6} />
        <Button loading={loading} disabled={otp.trim().length < 6} onPress={submit}>Verify</Button>
      </View>
    </AuthShell>
  );
}

export function ResetPasswordScreen({
  route,
}: NativeStackScreenProps<AuthStackParamList, "ResetPassword">) {
  const { setTokens } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = password.length >= 8 && password === confirmPassword;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const tokens = await authApi.resetPassword({
        token: route.params.tempToken,
        new_password: password,
      });
      await setTokens(tokens);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.formContainer}>
        <View style={styles.headerCentered}>
          <Text style={[uiStyles.h1, { textAlign: "center" }]}>New password</Text>
          <Text style={[uiStyles.subtitle, { textAlign: "center" }]}>Choose a new secure password.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field label="Password" secureTextEntry onChangeText={setPassword} value={password} />
        <Field label="Confirm password" secureTextEntry onChangeText={setConfirmPassword} value={confirmPassword} />
        <Button loading={loading} disabled={!canSubmit} onPress={submit}>Update password</Button>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  logo: {
    height: 120,
    width: 120,
  },
  headerCentered: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  formContainer: {
    gap: spacing.xl,
  },
  security: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  securityDot: {
    backgroundColor: colors.success,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  securityText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  passwordInputWrap: {
    position: "relative",
  },
  eyeButton: {
    padding: spacing.md,
    position: "absolute",
    right: 0,
    top: 0,
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  linkStrong: {
    color: colors.primary,
    fontWeight: "900",
  },
  centerPress: {
    alignItems: "center",
  },
  otpRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  otpBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 48,
  },
  otpText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  requirementOk: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800",
  },
});
