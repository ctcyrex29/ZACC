import React, { useState, useEffect } from "react";
import { apiClient } from "../services/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "INVESTIGATOR" | "WHISTLEBLOWER";
  created_at: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "INVESTIGATOR" as const,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers();
      if (response.success && Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setError("Failed to fetch users");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role: "INVESTIGATOR",
    });
    setEditingId(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);

    try {
      if (editingId) {
        const response = await apiClient.updateUser(editingId, formData);
        if (response.success) {
          await fetchUsers();
          setShowForm(false);
          resetForm();
        } else {
          setSubmitError(
            response.errors
              ? Object.values(response.errors).flat().join(", ")
              : response.message,
          );
        }
      } else {
        const response = await apiClient.createUser(formData);
        if (response.success) {
          await fetchUsers();
          setShowForm(false);
          resetForm();
        } else {
          setSubmitError(
            response.errors
              ? Object.values(response.errors).flat().join(", ")
              : response.message,
          );
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save user");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const response = await apiClient.deleteUser(id);
      if (response.success) {
        await fetchUsers();
      } else {
        setError(response.message || "Failed to delete user");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "INVESTIGATOR":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-nexus-emerald/20 border-t-nexus-emerald animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
          <p className="text-rose-400 text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            User Management
          </h2>
          <p className="text-slate-500 font-medium">
            Create and manage admin and investigator accounts
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-6 py-3 bg-nexus-emerald text-nexus-950 rounded-2xl font-bold text-sm hover:bg-emerald-400 transition-all soft-glow"
        >
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-8 rounded-4xl">
          <h3 className="text-lg font-bold text-white mb-6">
            {editingId ? "Edit User" : "Create New User"}
          </h3>

          {submitError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <p className="text-rose-400 text-sm font-bold">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="John Investigator"
                  className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all bg-white/5"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="john@zacc.org.zw"
                  className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all bg-white/5"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">
                  Role
                </label>
                <select
                  className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all bg-white/5"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "ADMIN" | "INVESTIGATOR",
                    })
                  }
                >
                  <option value="INVESTIGATOR" className="bg-slate-900">
                    Investigator
                  </option>
                  <option value="ADMIN" className="bg-slate-900">
                    Admin
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all bg-white/5"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                  required={!editingId}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all bg-white/5"
                  value={formData.password_confirmation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password_confirmation: e.target.value,
                    })
                  }
                  required={!editingId}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitLoading}
                className="flex-1 px-6 py-3 bg-nexus-emerald text-nexus-950 rounded-2xl font-bold text-sm hover:bg-emerald-400 transition-all soft-glow disabled:opacity-50"
              >
                {submitLoading
                  ? "Saving..."
                  : editingId
                    ? "Update User"
                    : "Create User"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 px-6 py-3 bg-white/5 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {users.length === 0 ? (
        <div className="glass-card p-12 rounded-4xl text-center">
          <div className="w-16 h-16 bg-slate-500/10 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 opacity-60">
            👥
          </div>
          <p className="text-slate-400 font-medium">
            No users found. Create your first user to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <div
              key={user.id}
              className="glass-card p-6 rounded-3xl border border-white/5 hover:border-nexus-emerald/20 transition-all duration-300 flex flex-col"
            >
              <div className="flex-1 mb-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">
                      {user.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mb-3">
                      {user.email}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border whitespace-nowrap ${getRoleColor(user.role)}`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Member Since
                  </p>
                  <p className="text-sm text-slate-300 font-semibold">
                    {new Date(user.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-white/5">
                <button
                  onClick={() => {
                    setEditingId(user.id);
                    setFormData({
                      name: user.name,
                      email: user.email,
                      password: "",
                      password_confirmation: "",
                      role: user.role,
                    });
                    setShowForm(true);
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="flex-1 px-4 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
