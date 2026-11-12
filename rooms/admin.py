from django.contrib import admin
from .models import Floor, Payment, Room, RoomPhoto, Tenancy, ViewingRequest


class RoomPhotoInline(admin.TabularInline):
    model = RoomPhoto
    extra = 3


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("number", "floor", "room_type", "rent", "status")
    list_filter = ("floor", "status")
    inlines = [RoomPhotoInline]


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 1


@admin.register(Tenancy)
class TenancyAdmin(admin.ModelAdmin):
    list_display = ("tenant", "room", "date_in", "date_out")
    list_filter = ("room",)
    inlines = [PaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "tenancy", "month_covered", "amount", "method", "reference", "paid_on")


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ("number", "name")


@admin.register(ViewingRequest)
class ViewingRequestAdmin(admin.ModelAdmin):
    list_display = ("name", "room_number", "preferred_date", "preferred_slot", "phone", "status", "created_at")
    list_filter = ("status", "preferred_slot")
    search_fields = ("name", "phone", "email", "room_number")
