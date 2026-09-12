package com.fitness.backend.service;

import com.fitness.backend.dto.request.LoginRequest;
import com.fitness.backend.dto.request.RegisterRequest;
import com.fitness.backend.dto.response.AuthResponse;
import com.fitness.backend.entity.User;
import com.fitness.backend.repository.UserRepository;
import com.fitness.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private UserService userService;

    private User testUser;
    private RegisterRequest registerRequest;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .email("test@email.com")
                .passwordHash("hashedPassword")
                .username("testUser")
                .build();

        registerRequest = new RegisterRequest("test@email.com", "test1234", "testUser");
    }

    @Test
    void register_Success_ReturnsAuthResponse() {
        when(userRepository.existsByEmail(registerRequest.email())).thenReturn(false);
        when(passwordEncoder.encode(registerRequest.password())).thenReturn("hashedPassword");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(jwtUtil.generateToken(testUser.getEmail())).thenReturn("mockJwtToken");

        AuthResponse response = userService.register(registerRequest);

        assertNotNull(response);
        assertEquals("mockJwtToken", response.token());
        assertEquals("test@email.com", response.email());
        assertEquals("testUser", response.username());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void register_EmailAlreadyExists_ThrowsException() {
        when(userRepository.existsByEmail(registerRequest.email())).thenReturn(true);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            userService.register(registerRequest);
        });
        assertEquals("Email already registered: test@email.com", exception.getMessage());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_Success_ReturnsAuthResponse() {
        LoginRequest loginRequest = new LoginRequest("test@email.com", "test1234");
        Authentication authentication = mock(Authentication.class);
        
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(userRepository.findByEmail(loginRequest.email())).thenReturn(Optional.of(testUser));
        when(jwtUtil.generateToken(testUser.getEmail())).thenReturn("mockJwtToken");

        AuthResponse response = userService.login(loginRequest);

        assertNotNull(response);
        assertEquals("mockJwtToken", response.token());
        assertEquals("test@email.com", response.email());
        verify(authenticationManager, times(1)).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }
}
