"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { authApi, filesApi, getApiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, LogOut, Loader2, Check, User, Trash2, Camera } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Image from "next/image";

export default function ProfilePage() {
  const { student, logout, refreshStudent } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, "Erreur."));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);

    try {
      await filesApi.uploadMyPhoto(file);
      await refreshStudent();
      toast({
        title: "Photo mise à jour",
        description: "Votre photo de profil a bien été enregistrée.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erreur d'upload",
        description: getApiErrorMessage(err, "Impossible d'importer la photo."),
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handlePhotoDelete = async () => {
    setPhotoRemoving(true);
    try {
      await filesApi.deleteMyPhoto();
      await refreshStudent();
      toast({
        title: "Photo supprimée",
        description: "Votre photo de profil a été supprimée.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erreur de suppression",
        description: getApiErrorMessage(err, "Impossible de supprimer la photo."),
        variant: "destructive",
      });
    } finally {
      setPhotoRemoving(false);
    }
  };

  return (
    <div className="page-enter space-y-8 max-w-2xl mx-auto px-1">
      <h1 className="text-2xl sm:text-3xl font-bold">Mon Profil</h1>

      {/* Student Info */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <label className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer">
              {student?.photo_url ? (
                <Image src={student.photo_url} alt="photo" width={80} height={80} className="w-full h-full object-cover" unoptimized />
              ) : (
                <User className="h-8 w-8 text-primary" />
              )}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
                {photoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void handlePhotoUpload(e)}
                disabled={photoUploading || photoRemoving}
              />
            </label>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">
                {student?.first_name} {student?.last_name}
              </h2>
              <p className="text-sm text-on-surface-variant">CNE : {student?.cne}</p>
              {student?.phone && (
                <p className="text-sm text-on-surface-variant">{student.phone}</p>
              )}
            </div>
            {student?.photo_url && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-start sm:self-center h-8 w-8 text-on-surface-variant hover:text-red-600"
                onClick={() => void handlePhotoDelete()}
                disabled={photoUploading || photoRemoving}
                title="Supprimer la photo"
              >
                {photoRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-on-surface-variant mt-2">
            Survolez la photo pour la modifier. Formats: JPG/PNG, taille max 2MB.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="sanctuary-card-subtle !p-4">
              <span className="label-sanctuary">Classe</span>
              <p className="font-semibold text-sm mt-1">{student?.class_name || "—"}</p>
            </div>
            <div className="sanctuary-card-subtle !p-4">
              <span className="label-sanctuary">Filière</span>
              <p className="font-semibold text-sm mt-1">{student?.filiere_name || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Changer le mot de passe
          </h3>

          {passwordSuccess && (
            <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Mot de passe modifié avec succès.
            </div>
          )}

          {passwordError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{passwordError}</div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Ancien mot de passe</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={passwordLoading} className="w-full">
              {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Modifier"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button variant="destructive" onClick={logout} className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        Se déconnecter
      </Button>
    </div>
  );
}
