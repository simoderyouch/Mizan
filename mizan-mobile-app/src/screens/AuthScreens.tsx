import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Eye, EyeOff } from "lucide-react-native";
import { Screen } from "../components/screen";
import { Button, Card, ErrorBanner, Field, styles as uiStyles } from "../components/ui";
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
        <Text style={uiStyles.subtitle}>Votre espace de sérénité numérique</Text>
      </View>
      {children}
      <View style={styles.security}>
        <View style={styles.securityDot} />
        <Text style={styles.securityText}>Système sécurisé</Text>
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
      setError(getApiErrorMessage(err, "Email ou mot de passe incorrect."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card style={{ gap: spacing.lg }}>
        <View>
          <Text style={uiStyles.h1}>Bienvenue</Text>
          <Text style={uiStyles.subtitle}>Connectez-vous pour retrouver votre équilibre.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Adresse e-mail"
          onChangeText={setEmail}
          placeholder="nom@exemple.com"
          value={email}
        />
        <View>
          <View style={styles.passwordLabelRow}>
            <Text style={uiStyles.label}>Mot de passe</Text>
            <Pressable onPress={() => navigation.navigate("Activate")}>
              <Text style={styles.link}>Mot de passe oublié ?</Text>
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
          Se connecter
        </Button>
        <Pressable onPress={() => navigation.navigate("Activate")} style={styles.centerPress}>
          <Text style={uiStyles.muted}>
            Nouveau sur Mizan ? <Text style={styles.linkStrong}>Activer mon compte</Text>
          </Text>
        </Pressable>
      </Card>
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
      setError(getApiErrorMessage(err, "Impossible d'envoyer le code. Vérifiez votre adresse e-mail."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card style={{ gap: spacing.lg }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
        <View>
          <Text style={uiStyles.h1}>Activer mon compte</Text>
          <Text style={uiStyles.subtitle}>
            Entrez votre adresse e-mail académique pour recevoir un code d'activation.
          </Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          label="Adresse e-mail"
          onChangeText={setEmail}
          placeholder="votre.email@ecole.ma"
          value={email}
        />
        <Button loading={loading} disabled={!email} onPress={submit}>
          Recevoir le code
        </Button>
      </Card>
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
      setError(getApiErrorMessage(err, "Code invalide. Veuillez réessayer."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card style={{ gap: spacing.lg }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
        <View>
          <Text style={uiStyles.h1}>Vérification</Text>
          <Text style={uiStyles.subtitle}>Entrez le code à 6 chiffres envoyé à {route.params.email}.</Text>
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
          Vérifier le code
        </Button>
      </Card>
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
      setError(getApiErrorMessage(err, "Erreur lors de la création du mot de passe."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card style={{ gap: spacing.lg }}>
        <View>
          <Text style={uiStyles.h1}>Créer votre mot de passe</Text>
          <Text style={uiStyles.subtitle}>Choisissez un mot de passe sécurisé pour votre compte Mizan.</Text>
        </View>
        <ErrorBanner message={error} />
        <Field
          label="Mot de passe"
          onChangeText={setPassword}
          placeholder="8 caractères minimum"
          secureTextEntry
          value={password}
        />
        <Field
          label="Confirmer le mot de passe"
          onChangeText={setConfirmPassword}
          placeholder="Confirmez votre mot de passe"
          secureTextEntry
          value={confirmPassword}
        />
        <Text style={canSubmit ? styles.requirementOk : uiStyles.muted}>
          8 caractères minimum et mots de passe identiques
        </Text>
        <Button loading={loading} disabled={!canSubmit} onPress={submit}>
          Créer mon compte
        </Button>
      </Card>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  logo: {
    height: 80,
    width: 132,
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
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 42,
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
