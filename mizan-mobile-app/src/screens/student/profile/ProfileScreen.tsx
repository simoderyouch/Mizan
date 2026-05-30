import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { User } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  styles as uiStyles,
} from "../../../components/ui";
import { authApi, filesApi, getApiErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { colors } from "../../../theme";
import { styles } from "../styles";

export function ProfileScreen() {
  const { student, refreshStudent, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoBusy(true);
    setError("");
    try {
      await filesApi.uploadMyPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "profile.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      await refreshStudent();
      setMessage("Photo updated.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not upload photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setPhotoBusy(true);
    setError("");
    try {
      await filesApi.deleteMyPhoto();
      await refreshStudent();
      setMessage("Photo deleted.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const changePassword = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword("");
      setNewPassword("");
      setMessage("Password successfully updated.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not change password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen variant="stack">
      <ErrorBanner message={error} />
      {message ? <Card style={[styles.gapCard, { backgroundColor: colors.successSoft }]}><Text style={{ color: colors.success, fontWeight: "800" }}>{message}</Text></Card> : null}
      <Card style={styles.gapCard}>
        <Pressable onPress={pickPhoto} style={styles.profileHeader}>
          {student?.photo_url ? <Image source={{ uri: student.photo_url }} style={styles.avatar} /> : <View style={styles.avatar}><User color={colors.primary} size={34} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={uiStyles.h2}>{student?.first_name} {student?.last_name}</Text>
            <Text style={uiStyles.muted}>{student?.email ?? "No email on file"}</Text>
            <Text style={uiStyles.muted}>CNE: {student?.cne}</Text>
            <Text style={uiStyles.muted}>{student?.class_name ?? "No class assigned"}</Text>
            {student?.created_at ? (
              <Text style={uiStyles.muted}>
                Member since {new Date(student.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.inlineActions}>
          <Button loading={photoBusy} variant="secondary" onPress={pickPhoto} style={styles.inlineActionButton}>Change photo</Button>
          {student?.photo_url ? <Button loading={photoBusy} variant="ghost" onPress={deletePhoto} style={styles.inlineActionButton}>Delete</Button> : null}
        </View>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Change password</Text>
        <Field label="Old password" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
        <Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <Button loading={loading} disabled={!oldPassword || newPassword.length < 8} onPress={changePassword}>Update</Button>
      </Card>
      <Button variant="danger" onPress={() => { void logout(); }}>Log out</Button>
    </Screen>
  );
}
