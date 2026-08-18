import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async guestLogin(name?: string): Promise<{ token: string; user: Partial<UserDocument> }> {
    // Generate a unique guest name if not provided
    const guestName = name || `Guest_${Math.random().toString(36).substring(2, 8)}`;

    // Create guest user
    const user = new this.userModel({
      name: guestName,
      isGuest: true,
    });
    await user.save();

    // Sign JWT
    const payload = { sub: user._id.toString(), name: user.name };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        isGuest: user.isGuest,
      },
    };
  }

  async getProfile(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async updateProfile(
    userId: string,
    updateData: { name?: string; email?: string; title?: string; username?: string },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, updateData, { returnDocument: 'after' })
      .exec();
  }
}
