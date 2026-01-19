"use client";

import { useState, useEffect } from "react";
import { Bell, Trash2, Check, ExternalLink, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";

interface Notification {
	id: string;
	title: string;
	message: string;
	link?: string | null;
	type: "SYSTEM" | "MARKETING";
	priority: "LOW" | "MEDIUM" | "HIGH";
	isRead: boolean;
	createdAt: string;
}

export function NotificationsDropdown() {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState(false);
	const router = useRouter();

	useEffect(() => {
		fetchNotifications();
	}, []);

	const fetchNotifications = async () => {
		// If we already encountered an error, don't keep trying
		if (error) return;

		setLoading(true);
		try {
			// Check if we have an access token first
			const token = TokenStorage.getAccessToken();
			if (!token) {
				console.error("No access token available for notifications");
				setError(true);
				setLoading(false);
				return;
			}

			// Use fetchWithTokenRefresh for automatic token handling
			const data = await fetchWithTokenRefresh<{
				notifications: Notification[];
			}>("/api/notifications?limit=5");

			
			// Sort notifications by createdAt date (latest first)
			const sortedNotifications = (data.notifications || []).sort((a, b) => 
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
			
			setNotifications(sortedNotifications);
			setUnreadCount(
				sortedNotifications.filter(
					(n: Notification) => !n.isRead
				).length
			);
			setError(false);
		} catch (error) {
			console.error("Error fetching notifications:", error);
			setError(true);
			// Don't show toast for auth errors to avoid spam
			if (
				!(
					error instanceof Error &&
					error.message.includes("access token")
				)
			) {
				toast.error("Failed to fetch notifications");
			}
		} finally {
			setLoading(false);
		}
	};

	const markAsRead = async (notificationIds: string[]) => {
		try {
			const headers = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
			};

			const response = await fetch("/api/notifications", {
				method: "PATCH",
				headers,
				body: JSON.stringify({ notificationIds }),
			});

			if (!response.ok)
				throw new Error("Failed to mark notifications as read");

			setNotifications(
				notifications.map((notification) =>
					notificationIds.includes(notification.id)
						? { ...notification, isRead: true }
						: notification
				)
			);
			setUnreadCount((prev) =>
				Math.max(0, prev - notificationIds.length)
			);
		} catch (error) {
			console.error("Error marking as read:", error);
			toast.error("Failed to mark notifications as read");
		}
	};

	const deleteNotification = async (id: string) => {
		try {
			const headers = {
				Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
			};

			const response = await fetch(`/api/notifications/${id}`, {
				method: "DELETE",
				headers,
			});

			if (!response.ok) throw new Error("Failed to delete notification");

			setNotifications(notifications.filter((n) => n.id !== id));
			if (!notifications.find((n) => n.id === id)?.isRead) {
				setUnreadCount((prev) => Math.max(0, prev - 1));
			}

			toast.success("Notification deleted");
		} catch (error) {
			console.error("Error deleting notification:", error);
			toast.error("Failed to delete notification");
		}
	};

	const handleNotificationClick = async (notification: Notification) => {
		try {

			if (!notification.link) {
				if (!notification.isRead) {
					await markAsRead([notification.id]);
				}
				return;
			}

			setOpen(false);

			if (notification.link.startsWith("http")) {
				window.location.href = notification.link;
			} else {
				router.push(notification.link);
			}

			if (!notification.isRead) {
				await markAsRead([notification.id]).catch(console.error);
			}

			return;
		} catch (error) {
			console.error("Error handling notification click:", error);
			return;
		}
	};

	const getReadStatusColor = (isRead: boolean) => {
		return isRead ? "bg-gray-300" : "bg-blue-500";
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative bg-white hover:bg-purple-primary/5 text-gray-700 hover:text-purple-primary border border-gray-200 hover:border-purple-primary/20 transition-colors shadow-sm"
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-80 bg-white/95 backdrop-blur-lg border-gray-200 shadow-lg"
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-200">
					<h2 className="font-semibold text-gray-700 font-heading">
						Notifications
					</h2>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => fetchNotifications()}
							className="text-xs text-gray-500 hover:text-purple-primary hover:bg-purple-primary/5 font-body"
							disabled={loading}
						>
							<RotateCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
						</Button>
						{unreadCount > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									markAsRead(
										notifications
											.filter((n) => !n.isRead)
											.map((n) => n.id)
									)
								}
								className="text-xs text-gray-500 hover:text-purple-primary hover:bg-purple-primary/5 font-body"
							>
								Mark all as read
							</Button>
						)}
					</div>
				</div>
				<ScrollArea className="h-[400px]">
					{loading ? (
						Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="p-4 border-b border-gray-200"
							>
								<Skeleton className="h-4 w-3/4 mb-2 bg-gray-200" />
								<Skeleton className="h-3 w-full bg-gray-200" />
							</div>
						))
					) : error ? (
						<div className="p-4 text-center text-gray-500">
							Unable to load notifications
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={fetchNotifications}
									className="text-xs bg-white hover:bg-purple-primary/5 border-gray-200 hover:border-purple-primary/20 text-gray-700 hover:text-purple-primary font-body"
								>
									Retry
								</Button>
							</div>
						</div>
					) : notifications.length === 0 ? (
						<div className="p-4 text-center text-gray-500 font-body">
							No notifications
						</div>
					) : (
						notifications.map((notification) => (
							<div
								key={notification.id}
								className={`group p-4 border-b border-gray-200 hover:bg-purple-primary/5 transition-colors ${
									!notification.isRead
										? "bg-blue-tertiary/5 border-l-4 border-l-blue-tertiary"
										: ""
								} ${notification.link ? "cursor-pointer" : ""}`}
								onClick={(e) => {
									e.preventDefault();
									handleNotificationClick(notification);
								}}
							>
								<div className="flex items-start gap-2">
									<div
										className={`w-2 h-2 rounded-full mt-2 ${getReadStatusColor(
											notification.isRead
										)}`}
									/>
									<div className="flex-1 min-w-0">
										<div className="font-bold text-gray-700 flex items-center gap-2 font-heading">
											{notification.title}
											{notification.link && (
												<ExternalLink className="h-3 w-3 text-gray-500" />
											)}
										</div>
										<p className="text-sm text-gray-600 font-body">
											{notification.message}
										</p>
										<div className="flex items-center justify-between mt-2">
											<span className="text-xs text-gray-500 font-body">
												{format(
													new Date(
														notification.createdAt
													),
													"MMM d, h:mm a"
												)}
											</span>
											<div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
												{!notification.isRead && (
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-gray-500 hover:text-blue-tertiary hover:bg-blue-tertiary/10"
														onClick={(e) => {
															e.stopPropagation();
															markAsRead([
																notification.id,
															]);
														}}
														title="Mark as read"
													>
														<Check className="h-3 w-3" />
													</Button>
												)}
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-gray-500 hover:text-red-500 hover:bg-red-50"
													onClick={(e) => {
														e.stopPropagation();
														deleteNotification(
															notification.id
														);
													}}
													title="Delete"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						))
					)}
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
